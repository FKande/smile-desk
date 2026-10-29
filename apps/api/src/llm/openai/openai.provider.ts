import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { toResponseInputItems } from 'openai/lib/responses/ResponseInputItems';
import { PRACTICE } from '../../practice/practice.js';
import { opaqueId } from '../anthropic/anthropic.provider.js';
import { LlmSettingsService } from '../llm-settings.service.js';
import type { LlmProvider, ToolCall, TranscriptItem, TurnRequest, TurnResult } from '../llm.types.js';
import { resolveOpenAiSettings, type OpenAiSettings } from './openai.settings.js';

type Params = Omit<OpenAI.Responses.ResponseCreateParams, 'stream' | 'stream_options'>;
type InputItem = OpenAI.Responses.ResponseInputItem;

@Injectable()
export class OpenAiProvider implements LlmProvider {
  readonly name = 'openai' as const;
  private readonly logger = new Logger('OpenAI');
  private client?: { key: string; instance: OpenAI };

  constructor(private readonly settingsService: LlmSettingsService) {}

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async runTurn(request: TurnRequest): Promise<TurnResult> {
    const resolved = resolveOpenAiSettings(this.settingsService.get().openai);
    for (const warning of resolved.warnings) this.logger.warn(warning);
    const params = this.buildParams(request, resolved.settings, resolved.effort);
    const client = this.getClient(resolved.settings);

    const response = resolved.settings.stream
      ? await client.responses
          .stream({ ...params, stream_options: { include_obfuscation: resolved.settings.includeObfuscation } })
          .finalResponse()
      : await client.responses.create({ ...params, stream: false });

    const toolCalls: ToolCall[] = response.output.flatMap((item) =>
      item.type === 'function_call' ? [{ id: item.call_id, name: item.name, input: parseArguments(item.arguments) }] : [],
    );

    const incomplete = response.status === 'incomplete';
    const refused = response.output.some(
      (item) => item.type === 'message' && item.content.some((c) => c.type === 'refusal'),
    );
    return {
      provider: this.name,
      model: response.model,
      text: response.output_text.trim(),
      toolCalls,
      native: response.output,
      stopReason: refused
        ? 'refusal'
        : incomplete && response.incomplete_details?.reason === 'max_output_tokens'
          ? 'max_tokens'
          : toolCalls.length
            ? 'tool_use'
            : incomplete
              ? 'other'
              : 'end',
      usage: {
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
        cacheReadTokens: response.usage?.input_tokens_details?.cached_tokens ?? 0,
        cacheWriteTokens: 0,
      },
      warnings: resolved.warnings,
    };
  }

  private buildParams(request: TurnRequest, s: OpenAiSettings, effort: string): Params {
    const reasoning: NonNullable<Params['reasoning']> = { effort: effort as 'low' };
    if (s.reasoningSummary !== 'off') reasoning.summary = s.reasoningSummary;
    if (s.reasoningContext !== 'auto') reasoning.context = s.reasoningContext;
    if (s.reasoningMode !== 'standard') reasoning.mode = s.reasoningMode;

    return {
      model: s.model,
      instructions: request.system,
      input: toInputItems(request.transcript),
      tools: request.tools.map((tool) => ({
        type: 'function' as const,
        name: tool.name,
        description: tool.description,
        parameters: { ...tool.inputSchema },
        strict: s.strictTools,
      })),
      tool_choice: s.toolChoice,
      parallel_tool_calls: s.parallelToolCalls,
      max_output_tokens: s.maxOutputTokens,
      reasoning,
      text: { verbosity: s.verbosity },
      store: s.store,
      truncation: s.truncation,
      service_tier: s.serviceTier,
      ...(s.promptCacheKey === 'per_location' ? { prompt_cache_key: `smile-desk:${PRACTICE.locationId}` } : {}),
      prompt_cache_options: { mode: s.promptCacheMode, prewarm: s.promptCachePrewarm },
      ...(s.sendSafetyIdentifier ? { safety_identifier: opaqueId(request.conversationId) } : {}),
      ...(s.moderation !== 'off'
        ? { moderation: { model: s.moderationModel, policy: { input: { mode: s.moderation }, output: { mode: s.moderation } } } }
        : {}),
      ...(s.temperature !== null ? { temperature: s.temperature } : {}),
      ...(s.topP !== null ? { top_p: s.topP } : {}),
    };
  }

  private getClient(s: OpenAiSettings): OpenAI {
    const key = `${process.env.OPENAI_API_KEY}|${s.timeoutMs}|${s.maxRetries}`;
    if (this.client?.key !== key) {
      this.client = { key, instance: new OpenAI({ timeout: s.timeoutMs, maxRetries: s.maxRetries }) };
    }
    return this.client.instance;
  }
}

/** Replays our own OpenAI turns verbatim (reasoning items included); rebuilds turns another provider produced. */
export function toInputItems(transcript: TranscriptItem[]): InputItem[] {
  const items: InputItem[] = [];
  for (const item of transcript) {
    if (item.kind === 'user') {
      items.push({ role: 'user', content: item.context ? `${item.context}\n\n${item.text}` : item.text });
    } else if (item.kind === 'tool_results') {
      for (const r of item.results) items.push({ type: 'function_call_output', call_id: r.callId, output: r.output });
    } else if (item.native?.provider === 'openai') {
      items.push(...toResponseInputItems(item.native.data as OpenAI.Responses.ResponseOutputItem[]));
    } else {
      if (item.text) items.push({ role: 'assistant', content: item.text });
      for (const call of item.toolCalls) {
        items.push({ type: 'function_call', call_id: call.id, name: call.name, arguments: JSON.stringify(call.input) });
      }
    }
  }
  return items;
}

function parseArguments(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return { __invalid_json: raw };
  }
}
