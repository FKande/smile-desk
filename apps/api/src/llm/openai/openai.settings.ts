import { z } from 'zod';

// Every Responses API knob we expose, validated. Model rules live in OPENAI_MODELS
// so an unsupported setting is dropped with a warning, never sent as a 400.
// Source: developers.openai.com API reference + guides (verified 2026-10-29),
// openai npm 7.x. Tool calling on the GPT-6 family requires the Responses API.

export const REASONING_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
type Effort = (typeof REASONING_EFFORTS)[number];

export const openAiSettingsSchema = z
  .object({
    model: z.string().min(1).default('gpt-6.1-sol'),
    /** Includes reasoning tokens. */
    maxOutputTokens: z.number().int().min(16).max(128_000).default(16_000),
    stream: z.boolean().default(true),
    reasoningEffort: z.enum(REASONING_EFFORTS).optional(),
    /** Reasoning summaries in the output: off, or auto / concise / detailed. */
    reasoningSummary: z.enum(['off', 'auto', 'concise', 'detailed']).default('off'),
    /** Which turns' reasoning the model can see (GPT-5.6+ default: all_turns). */
    reasoningContext: z.enum(['auto', 'current_turn', 'all_turns']).default('auto'),
    reasoningMode: z.enum(['standard', 'pro']).default('standard'),
    /** Answer length. Low suits chat. */
    verbosity: z.enum(['low', 'medium', 'high']).default('low'),
    toolChoice: z.enum(['auto', 'required', 'none']).default('auto'),
    parallelToolCalls: z.boolean().default(true),
    strictTools: z.boolean().default(true),
    /** false = OpenAI keeps nothing; we replay full history incl. encrypted reasoning. */
    store: z.boolean().default(false),
    /** auto drops the oldest context instead of failing when the window overflows. */
    truncation: z.enum(['auto', 'disabled']).default('auto'),
    serviceTier: z.enum(['auto', 'default', 'flex', 'scale', 'priority', 'fast']).default('auto'),
    /** Stable cache key per practice location (separate cache accounting). */
    promptCacheKey: z.enum(['per_location', 'off']).default('per_location'),
    promptCacheMode: z.enum(['implicit', 'explicit']).default('implicit'),
    promptCachePrewarm: z.boolean().default(false),
    /** Send a hashed per-conversation id as safety_identifier. */
    sendSafetyIdentifier: z.boolean().default(true),
    /** Built-in moderation of input and output: off, score (annotate) or block. */
    moderation: z.enum(['off', 'score', 'block']).default('off'),
    moderationModel: z.string().min(1).default('omni-moderation-latest'),
    /** Only honoured with reasoningEffort "none" on models that support it. */
    temperature: z.number().min(0).max(2).nullable().default(null),
    topP: z.number().min(0).max(1).nullable().default(null),
    /** Stream obfuscation padding; off saves bandwidth. */
    includeObfuscation: z.boolean().default(false),
    timeoutMs: z.number().int().min(5_000).max(600_000).default(60_000),
    maxRetries: z.number().int().min(0).max(6).default(2),
  })
  .strict();

export type OpenAiSettings = z.infer<typeof openAiSettingsSchema>;

export interface OpenAiModelCapabilities {
  label: string;
  efforts: Effort[];
  defaultEffort: Effort;
  maxOutputTokens: number;
  priceNote: string;
}

export const OPENAI_MODELS: Record<string, OpenAiModelCapabilities> = {
  'gpt-6-astra': {
    label: 'GPT-6 Astra (flagship)',
    efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
    defaultEffort: 'medium', // not stated for Astra specifically; API default
    maxOutputTokens: 128_000,
    priceNote: '$10 / $50 per MTok',
  },
  'gpt-6.1-sol': {
    label: 'GPT-6.1 Sol (balanced, default)',
    efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
    defaultEffort: 'medium',
    maxOutputTokens: 128_000,
    priceNote: '$2 / $10 per MTok',
  },
  'gpt-6.1-terra': {
    label: 'GPT-6.1 Terra (fast)',
    efforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
    defaultEffort: 'medium',
    maxOutputTokens: 128_000,
    priceNote: '$1 / $5 per MTok',
  },
  'gpt-6-luna': {
    label: 'GPT-6 Luna (cheapest)',
    efforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
    defaultEffort: 'medium',
    maxOutputTokens: 128_000,
    priceNote: '$0.10 / $0.50 per MTok',
  },
};

const UNKNOWN: OpenAiModelCapabilities = {
  label: 'Custom model id',
  efforts: ['low', 'medium', 'high'],
  defaultEffort: 'medium',
  maxOutputTokens: 16_000,
  priceNote: 'unknown',
};

export const openAiCapabilitiesFor = (model: string): OpenAiModelCapabilities => OPENAI_MODELS[model] ?? UNKNOWN;

export interface ResolvedOpenAiSettings {
  settings: OpenAiSettings;
  capabilities: OpenAiModelCapabilities;
  effort: Effort;
  warnings: string[];
}

export function resolveOpenAiSettings(settings: OpenAiSettings): ResolvedOpenAiSettings {
  const caps = openAiCapabilitiesFor(settings.model);
  const warnings: string[] = [];
  const s = { ...settings };
  let effort = s.reasoningEffort ?? caps.defaultEffort;

  if (!caps.efforts.includes(effort)) {
    const fallback = caps.efforts.includes('low') ? 'low' : caps.defaultEffort;
    warnings.push(`reasoningEffort "${effort}" not supported on ${s.model}; using ${fallback}`);
    effort = fallback;
  }
  if (s.maxOutputTokens > caps.maxOutputTokens) {
    warnings.push(`maxOutputTokens lowered to ${caps.maxOutputTokens} (model limit)`);
    s.maxOutputTokens = caps.maxOutputTokens;
  }
  if ((s.temperature !== null || s.topP !== null) && effort !== 'none') {
    warnings.push('temperature/topP only apply with reasoningEffort "none"; ignored');
    s.temperature = null;
    s.topP = null;
  }
  if (s.temperature !== null && s.topP !== null) {
    warnings.push('set temperature or topP, not both; topP ignored');
    s.topP = null;
  }
  return { settings: s, capabilities: caps, effort, warnings };
}
