import { ValidationError } from '../common/errors.js';
import { createTestContext } from '../testing/test-context.js';
import { resolveAnthropicSettings, anthropicSettingsSchema } from './anthropic/anthropic.settings.js';
import { LlmSettingsService } from './llm-settings.service.js';
import { openAiSettingsSchema, resolveOpenAiSettings } from './openai/openai.settings.js';

describe('LlmSettingsService', () => {
  const ENV_KEYS = ['ANTHROPIC_MODEL', 'ANTHROPIC_MAX_TOKENS', 'ANTHROPIC_EFFORT', 'OPENAI_STREAM', 'ANTHROPIC_API_KEY'];
  let saved: Record<string, string | undefined>;
  let service: LlmSettingsService;

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    for (const k of ENV_KEYS) delete process.env[k];
    const ctx = createTestContext();
    service = new LlmSettingsService(ctx.db, ctx.clock);
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('layers defaults < env < saved overrides and reports the source of each value', () => {
    process.env.ANTHROPIC_MAX_TOKENS = '8000';
    process.env.OPENAI_STREAM = 'false';
    service.update({ anthropic: { effort: 'high' } });

    const { settings, sources } = service.describe();
    expect(settings.anthropic).toMatchObject({ model: 'claude-opus-5-5', maxTokens: 8000, effort: 'high' });
    expect(settings.openai.stream).toBe(false);
    expect(sources.anthropic).toMatchObject({ model: 'default', maxTokens: 'env', effort: 'override' });
  });

  it('skips an invalid env value instead of failing', () => {
    process.env.ANTHROPIC_EFFORT = 'turbo';
    expect(service.get().anthropic.effort).toBeUndefined();
    expect(service.describe().sources.anthropic.effort).toBe('default');
  });

  it('rejects invalid changes from the UI and keeps the previous settings', () => {
    expect(() => service.update({ anthropic: { maxTokens: 5 } })).toThrow(ValidationError);
    expect(() => service.update({ anthropic: { notAKnob: true } })).toThrow(ValidationError);
    expect(service.get().anthropic.maxTokens).toBe(16_000);
  });

  it('resets saved overrides', () => {
    service.update({ harness: { activeProvider: 'openai' } });
    expect(service.get().harness.activeProvider).toBe('openai');
    expect(service.reset('harness').harness.activeProvider).toBe('anthropic');
  });

  it('reports whether keys are set but never their values', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-secret';
    const described = JSON.stringify(service.describe());
    expect(service.describe().keys.anthropic).toBe(true);
    expect(described).not.toContain('sk-ant-test-secret');
  });
});

describe('model rules', () => {
  it('downgrades Anthropic settings the chosen model rejects', () => {
    const r = resolveAnthropicSettings(
      anthropicSettingsSchema.parse({ model: 'claude-opus-5-5', thinking: 'between_tools', toolChoice: 'any', stream: false, maxTokens: 64_000 }),
    );
    expect(r.settings).toMatchObject({ thinking: 'adaptive', toolChoice: 'auto', maxTokens: 16_000, eagerInputStreaming: false });
    expect(r.effort).toBe('medium');
    expect(r.warnings).toHaveLength(3);
  });

  it('allows thinking off on Sonnet 5.5 only up to high effort', () => {
    const ok = resolveAnthropicSettings(anthropicSettingsSchema.parse({ model: 'claude-sonnet-5-5', thinking: 'between_tools', effort: 'low' }));
    const tooHigh = resolveAnthropicSettings(anthropicSettingsSchema.parse({ model: 'claude-sonnet-5-5', thinking: 'between_tools', effort: 'max' }));
    expect(ok.settings.thinking).toBe('between_tools');
    expect(tooHigh.settings.thinking).toBe('adaptive');
  });

  it('only honours OpenAI sampling with reasoning off on models that allow it', () => {
    const sol = resolveOpenAiSettings(openAiSettingsSchema.parse({ model: 'gpt-6.1-sol', reasoningEffort: 'none', temperature: 0.4 }));
    expect(sol.effort).toBe('low');
    expect(sol.settings.temperature).toBeNull();

    const luna = resolveOpenAiSettings(openAiSettingsSchema.parse({ model: 'gpt-6-luna', reasoningEffort: 'none', temperature: 0.4 }));
    expect(luna.effort).toBe('none');
    expect(luna.settings.temperature).toBe(0.4);
  });
});
