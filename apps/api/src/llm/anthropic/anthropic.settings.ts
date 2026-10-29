import { z } from 'zod';

// Every Messages API knob we expose, validated. Model-specific rules live in
// ANTHROPIC_MODELS so a setting the chosen model rejects is dropped with a
// warning instead of turning a patient's message into a 400.
// Source: Anthropic API docs (claude-api skill, cached 2026-10-06) and the
// @anthropic-ai/sdk 1.3 type definitions, which send anthropic-version 2026-10-21.

export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

export const anthropicSettingsSchema = z
  .object({
    model: z.string().min(1).default('claude-opus-5-5'),
    /** Hard cap per response. Streaming is required by the SDK above ~16k. */
    maxTokens: z.number().int().min(256).max(128_000).default(16_000),
    stream: z.boolean().default(true),
    /** Thinking depth and overall token spend. Model defaults differ (see capabilities). */
    effort: z.enum(EFFORTS).optional(),
    /** adaptive = model decides; between_tools = thinking off (Sonnet 5.5 only); disabled = off (models that allow it). */
    thinking: z.enum(['adaptive', 'between_tools', 'disabled']).default('adaptive'),
    /** What thinking blocks contain. `updates` returns short progress notes (beta). */
    thinkingDisplay: z.enum(['omitted', 'summarized', 'updates']).default('omitted'),
    /** auto | none. any/tool are rejected by the newest models and are dropped there. */
    toolChoice: z.enum(['auto', 'any', 'none']).default('auto'),
    /** At most one tool call per turn. */
    disableParallelToolUse: z.boolean().default(false),
    /** Guarantees tool inputs validate against their schemas. */
    strictTools: z.boolean().default(true),
    /** Stream tool inputs as they are generated (streaming only); inputs are re-validated server-side by us. */
    eagerInputStreaming: z.boolean().default(true),
    stopSequences: z.array(z.string().min(1).max(64)).max(8).default([]),
    /** Prompt cache TTL for the static prefix (tools + system). */
    promptCache: z.enum(['off', '5m', '1h']).default('5m'),
    serviceTier: z.enum(['auto', 'standard_only']).default('auto'),
    /** Fast mode (beta, premium pricing): Opus 5.5 / Opus 5 only. */
    speed: z.enum(['standard', 'fast']).default('standard'),
    /** Where inference runs, e.g. "us" or "global". */
    inferenceGeo: z.string().min(2).max(16).nullable().default(null),
    /** Server-side refusal fallback ("default" routing by refusal category). */
    refusalFallback: z.boolean().default(true),
    /** Advisory token budget for the whole tool loop (beta, min 20k). */
    taskBudgetTokens: z.number().int().min(20_000).max(1_000_000).nullable().default(null),
    /** Server-side compaction of very long conversations (beta). */
    compaction: z.boolean().default(false),
    /** Send an opaque per-conversation id as metadata.user_id (abuse detection). */
    sendUserId: z.boolean().default(true),
    timeoutMs: z.number().int().min(5_000).max(600_000).default(60_000),
    maxRetries: z.number().int().min(0).max(6).default(2),
  })
  .strict();

export type AnthropicSettings = z.infer<typeof anthropicSettingsSchema>;

export interface AnthropicModelCapabilities {
  label: string;
  maxOutputTokens: number;
  defaultEffort: (typeof EFFORTS)[number];
  /** Thinking modes the model accepts. */
  thinkingModes: AnthropicSettings['thinking'][];
  /** `between_tools` / `disabled` are only allowed at or below this effort. */
  thinkingOffMaxEffort?: (typeof EFFORTS)[number];
  thinkingDisplayUpdates: boolean;
  forcedToolChoice: boolean;
  fastMode: boolean;
  refusalFallback: boolean;
  taskBudget: boolean;
  /** temperature / top_p / top_k: removed on every model in API version 2026-10-21. */
  sampling: false;
  priceNote: string;
}

const CURRENT_FAMILY = { sampling: false, maxOutputTokens: 128_000, taskBudget: true } as const;

export const ANTHROPIC_MODELS: Record<string, AnthropicModelCapabilities> = {
  'claude-opus-5-5': {
    ...CURRENT_FAMILY,
    label: 'Claude Opus 5.5 (default)',
    defaultEffort: 'medium',
    thinkingModes: ['adaptive'],
    thinkingDisplayUpdates: true,
    forcedToolChoice: false,
    fastMode: true,
    refusalFallback: true,
    priceNote: '$4 / $20 per MTok, cache reads $0.20',
  },
  'claude-sonnet-5-5': {
    ...CURRENT_FAMILY,
    label: 'Claude Sonnet 5.5',
    defaultEffort: 'high',
    thinkingModes: ['adaptive', 'between_tools'],
    thinkingOffMaxEffort: 'high',
    thinkingDisplayUpdates: true,
    forcedToolChoice: false,
    fastMode: false,
    refusalFallback: true,
    priceNote: '$2 / $10 per MTok, cache reads $0.20',
  },
  'claude-haiku-5-5': {
    ...CURRENT_FAMILY,
    label: 'Claude Haiku 5.5',
    defaultEffort: 'medium',
    thinkingModes: ['adaptive', 'disabled'],
    thinkingOffMaxEffort: 'high',
    thinkingDisplayUpdates: false,
    forcedToolChoice: true,
    fastMode: false,
    refusalFallback: false,
    priceNote: '$0.10 / $0.50 per MTok (prompts up to 100K)',
  },
  'claude-fable-5-1': {
    ...CURRENT_FAMILY,
    label: 'Claude Fable 5.1 (most capable)',
    defaultEffort: 'high',
    thinkingModes: ['adaptive'],
    thinkingDisplayUpdates: true,
    forcedToolChoice: false,
    fastMode: false,
    refusalFallback: true,
    priceNote: '$10 / $50 per MTok',
  },
  'claude-opus-5': {
    ...CURRENT_FAMILY,
    label: 'Claude Opus 5',
    defaultEffort: 'high',
    thinkingModes: ['adaptive', 'disabled'],
    thinkingOffMaxEffort: 'high',
    thinkingDisplayUpdates: false,
    forcedToolChoice: true,
    fastMode: true,
    refusalFallback: true,
    priceNote: '$5 / $25 per MTok',
  },
};

/** Unknown model ids get only the parameters every current model accepts. */
export const UNKNOWN_MODEL_CAPABILITIES: AnthropicModelCapabilities = {
  ...CURRENT_FAMILY,
  label: 'Custom model id',
  defaultEffort: 'high',
  thinkingModes: ['adaptive'],
  thinkingDisplayUpdates: false,
  forcedToolChoice: false,
  fastMode: false,
  refusalFallback: false,
  taskBudget: false,
  priceNote: 'unknown',
};

export const capabilitiesFor = (model: string): AnthropicModelCapabilities =>
  ANTHROPIC_MODELS[model] ?? UNKNOWN_MODEL_CAPABILITIES;

const effortRank = (e: (typeof EFFORTS)[number]) => EFFORTS.indexOf(e);

export interface ResolvedAnthropicSettings {
  settings: AnthropicSettings;
  capabilities: AnthropicModelCapabilities;
  effort: (typeof EFFORTS)[number];
  /** Settings that were adjusted because the chosen model does not support them. */
  warnings: string[];
}

/** Applies model rules to user settings. Never throws: unsupported knobs are downgraded and reported. */
export function resolveAnthropicSettings(settings: AnthropicSettings): ResolvedAnthropicSettings {
  const caps = capabilitiesFor(settings.model);
  const warnings: string[] = [];
  const s = { ...settings };
  const effort = s.effort ?? caps.defaultEffort;

  if (s.maxTokens > caps.maxOutputTokens) {
    warnings.push(`maxTokens lowered to ${caps.maxOutputTokens} (model limit)`);
    s.maxTokens = caps.maxOutputTokens;
  }
  if (!s.stream && s.maxTokens > 16_000) {
    warnings.push('maxTokens above 16000 needs streaming; lowered to 16000');
    s.maxTokens = 16_000;
  }
  if (!caps.thinkingModes.includes(s.thinking)) {
    warnings.push(`thinking "${s.thinking}" not supported on ${s.model}; using adaptive`);
    s.thinking = 'adaptive';
  } else if (s.thinking !== 'adaptive' && caps.thinkingOffMaxEffort && effortRank(effort) > effortRank(caps.thinkingOffMaxEffort)) {
    warnings.push(`thinking "${s.thinking}" requires effort ≤ ${caps.thinkingOffMaxEffort}; using adaptive`);
    s.thinking = 'adaptive';
  }
  if (s.thinkingDisplay === 'updates' && !caps.thinkingDisplayUpdates) {
    warnings.push(`thinkingDisplay "updates" not supported on ${s.model}; using omitted`);
    s.thinkingDisplay = 'omitted';
  }
  if (s.toolChoice === 'any' && !caps.forcedToolChoice) {
    warnings.push(`toolChoice "any" is rejected by ${s.model}; using auto`);
    s.toolChoice = 'auto';
  }
  if (s.speed === 'fast' && !caps.fastMode) {
    warnings.push(`fast mode not available on ${s.model}; using standard`);
    s.speed = 'standard';
  }
  if (s.refusalFallback && !caps.refusalFallback) {
    warnings.push(`server-side refusal fallback not available on ${s.model}; disabled`);
    s.refusalFallback = false;
  }
  if (s.taskBudgetTokens && !caps.taskBudget) {
    warnings.push(`task budgets not available on ${s.model}; disabled`);
    s.taskBudgetTokens = null;
  }
  if (s.eagerInputStreaming && !s.stream) s.eagerInputStreaming = false;

  return { settings: s, capabilities: caps, effort, warnings };
}
