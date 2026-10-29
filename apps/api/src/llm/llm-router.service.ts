import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { AnthropicProvider } from './anthropic/anthropic.provider.js';
import { LlmSettingsService } from './llm-settings.service.js';
import type { LlmProvider, ProviderName, TurnRequest, TurnResult } from './llm.types.js';
import { OpenAiProvider } from './openai/openai.provider.js';

export class LlmUnavailableError extends Error {
  constructor(readonly attempts: { provider: ProviderName; reason: string }[]) {
    super(`No LLM provider could answer: ${attempts.map((a) => `${a.provider} (${a.reason})`).join(', ')}`);
    this.name = 'LlmUnavailableError';
  }
}

/** Errors worth trying the other provider for; a bad request would fail there too. */
function isFailoverWorthy(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) return err.status === undefined || err.status === 401 || err.status === 403 || err.status === 408 || err.status === 429 || err.status >= 500;
  if (err instanceof OpenAI.APIError) return err.status === undefined || err.status === 401 || err.status === 403 || err.status === 408 || err.status === 429 || err.status >= 500;
  return true; // network errors, timeouts, unexpected SDK failures
}

const describe = (err: unknown): string =>
  err instanceof Anthropic.APIError || err instanceof OpenAI.APIError
    ? `HTTP ${err.status ?? 'connection'}: ${err.message.slice(0, 400)}`
    : err instanceof Error
      ? err.message.slice(0, 400)
      : String(err);

@Injectable()
export class LlmRouterService {
  private readonly logger = new Logger('LlmRouter');
  private readonly providers: Record<ProviderName, LlmProvider>;

  constructor(
    private readonly settings: LlmSettingsService,
    anthropic: AnthropicProvider,
    openai: OpenAiProvider,
  ) {
    this.providers = { anthropic, openai };
  }

  /** Runs a turn on the active provider, failing over once to the configured fallback. */
  async runTurn(request: TurnRequest): Promise<TurnResult> {
    const { activeProvider, fallbackProvider } = this.settings.get().harness;
    const order = [activeProvider, fallbackProvider].filter(
      (p, i, all): p is ProviderName => p !== 'none' && all.indexOf(p) === i,
    );
    const attempts: { provider: ProviderName; reason: string }[] = [];

    for (const name of order) {
      const provider = this.providers[name];
      if (!provider.isConfigured()) {
        attempts.push({ provider: name, reason: 'no API key' });
        continue;
      }
      const started = Date.now();
      try {
        const result = await provider.runTurn(request);
        const u = result.usage;
        this.logger.log(
          `${result.model} ${Date.now() - started}ms in=${u.inputTokens} out=${u.outputTokens} cache_read=${u.cacheReadTokens} cache_write=${u.cacheWriteTokens} stop=${result.stopReason}`,
        );
        if (attempts.length) this.logger.warn(`Served by fallback ${name} after: ${attempts.map((a) => a.reason).join('; ')}`);
        return result;
      } catch (err) {
        const reason = describe(err);
        attempts.push({ provider: name, reason });
        this.logger.error(`${name} failed after ${Date.now() - started}ms: ${reason}`);
        if (!isFailoverWorthy(err)) break;
      }
    }
    throw new LlmUnavailableError(attempts);
  }
}
