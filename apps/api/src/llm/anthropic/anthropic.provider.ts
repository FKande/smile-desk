import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { LlmSettingsService } from '../llm-settings.service.js';
import type {
  LlmProvider,
  StopReason,
  ToolCall,
  TranscriptItem,
  TurnRequest,
  TurnResult,
} from '../llm.types.js';
import { resolveAnthropicSettings, type AnthropicSettings } from './anthropic.settings.js';

type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

const BETA = {
  fallback: 'server-side-fallback-2026-07-01',
  displayUpdates: 'thinking-display-updates-2026-08-18',
  fast: 'fast-mode-2026-02-01',
  taskBudget: 'task-budgets-2026-03-13',
  compaction: 'compact-2026-01-12',
} as const;

const STOP_REASONS: Record<string, StopReason> = {
  end_turn: 'end',
  stop_sequence: 'end',
  tool_use: 'tool_use',
  max_tokens: 'max_tokens',
  refusal: 'refusal',
};

@Injectable()
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic' as const;
  private readonly logger = new Logger('Anthropic');
  private client?: { key: string; instance: Anthropic };

  constructor(private readonly settingsService: LlmSettingsService) {}

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async runTurn(request: TurnRequest): Promise<TurnResult> {
    const resolved = resolveAnthropicSettings(this.settingsService.get().anthropic);
    for (const warning of resolved.warnings) this.logger.warn(warning);
    const { params, betas } = this.buildParams(request, resolved.settings, resolved.effort);
    const client = this.getClient(resolved.settings);

    // A live consumer always gets a stream; the stream setting governs the non-streaming path.
    const message =
      resolved.settings.stream || request.onTextDelta
        ? await this.streamWithJsonRetry(client, params, betas, request)
        : await client.beta.messages.create({ ...params, betas });

    const toolCalls: ToolCall[] = message.content
      .filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
      .map((b) => ({ id: b.id, name: b.name, input: (b.input ?? {}) as Record<string, unknown> }));
    const text = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    return {
      provider: this.name,
      model: message.model,
      text,
      toolCalls,
      native: message.content,
      stopReason: STOP_REASONS[message.stop_reason ?? ''] ?? 'other',
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
      },
      warnings: resolved.warnings,
    };
  }

  /** With eager input streaming the SDK can fail to parse a tool input; re-issue that turn once. */
  private async streamWithJsonRetry(client: Anthropic, params: Params, betas: string[], request: TurnRequest) {
    for (let attempt = 0; ; attempt++) {
      try {
        const stream = client.beta.messages.stream({ ...params, betas });
        if (request.onTextDelta) stream.on('text', (delta) => request.onTextDelta?.(delta));
        return await stream.finalMessage();
      } catch (err) {
        if (err instanceof Anthropic.APIError || attempt >= 1) throw err;
        this.logger.warn('Tool input arrived as invalid JSON; re-issuing the turn');
        request.onReset?.();
      }
    }
  }

  private buildParams(request: TurnRequest, s: AnthropicSettings, effort: string): { params: Params; betas: string[] } {
    const betas: string[] = [];
    const ttl = s.promptCache === 'off' ? null : s.promptCache;

    const tools: Anthropic.Beta.BetaTool[] = request.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: { ...tool.inputSchema },
      ...(s.strictTools ? { strict: true } : {}),
      ...(s.eagerInputStreaming ? { eager_input_streaming: true } : {}),
    }));

    const thinking: Params['thinking'] =
      s.thinking === 'adaptive'
        ? { type: 'adaptive', display: s.thinkingDisplay }
        : s.thinking === 'between_tools'
          ? { type: 'between_tools' }
          : { type: 'disabled' };
    if (s.thinking === 'adaptive' && s.thinkingDisplay === 'updates') betas.push(BETA.displayUpdates);

    const outputConfig: NonNullable<Params['output_config']> = { effort: effort as 'medium' };
    if (s.taskBudgetTokens) {
      outputConfig.task_budget = { type: 'tokens', total: s.taskBudgetTokens };
      betas.push(BETA.taskBudget);
    }

    const params: Params = {
      model: s.model,
      max_tokens: s.maxTokens,
      // Static prefix (tools + system) is cached; the top-level breakpoint caches the growing history.
      system: [{ type: 'text', text: request.system, ...(ttl ? { cache_control: { type: 'ephemeral', ttl } } : {}) }],
      ...(ttl ? { cache_control: { type: 'ephemeral', ttl } } : {}),
      messages: toMessages(request.transcript),
      tools,
      tool_choice:
        s.toolChoice === 'none'
          ? { type: 'none' }
          : { type: s.toolChoice, disable_parallel_tool_use: s.disableParallelToolUse },
      thinking,
      output_config: outputConfig,
      service_tier: s.serviceTier,
      ...(s.stopSequences.length ? { stop_sequences: s.stopSequences } : {}),
      ...(s.inferenceGeo ? { inference_geo: s.inferenceGeo } : {}),
      ...(s.sendUserId ? { metadata: { user_id: opaqueId(request.conversationId) } } : {}),
    };
    if (s.speed === 'fast') {
      params.speed = 'fast';
      betas.push(BETA.fast);
    }
    if (s.refusalFallback) {
      params.fallbacks = 'default';
      betas.push(BETA.fallback);
    }
    if (s.compaction) {
      params.context_management = { edits: [{ type: 'compact_20260112' }] };
      betas.push(BETA.compaction);
    }
    return { params, betas };
  }

  private getClient(s: AnthropicSettings): Anthropic {
    const key = `${process.env.ANTHROPIC_API_KEY}|${s.timeoutMs}|${s.maxRetries}`;
    if (this.client?.key !== key) {
      this.client = { key, instance: new Anthropic({ timeout: s.timeoutMs, maxRetries: s.maxRetries }) };
    }
    return this.client.instance;
  }
}

/** Replays our own turns verbatim (thinking blocks included); rebuilds turns another provider produced. */
export function toMessages(transcript: TranscriptItem[]): Anthropic.Beta.BetaMessageParam[] {
  return transcript.map((item): Anthropic.Beta.BetaMessageParam => {
    if (item.kind === 'user') {
      return { role: 'user', content: item.context ? `${item.context}\n\n${item.text}` : item.text };
    }
    if (item.kind === 'tool_results') {
      return {
        role: 'user',
        content: item.results.map((r) => ({
          type: 'tool_result' as const,
          tool_use_id: r.callId,
          content: r.output,
          ...(r.isError ? { is_error: true } : {}),
        })),
      };
    }
    if (item.native?.provider === 'anthropic') {
      return { role: 'assistant', content: item.native.data as Anthropic.Beta.BetaContentBlockParam[] };
    }
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (item.text) content.push({ type: 'text', text: item.text });
    for (const call of item.toolCalls) content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input });
    return { role: 'assistant', content };
  });
}

/** Stable, non-reversible id for abuse tracking; never a patient identifier. */
export const opaqueId = (conversationId: string): string =>
  createHash('sha256').update(`smile-desk:${conversationId}`).digest('hex').slice(0, 32);
