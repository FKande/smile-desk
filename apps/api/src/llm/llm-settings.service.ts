import { Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { CLOCK, type Clock } from '../common/clock.js';
import { ValidationError } from '../common/errors.js';
import { toUtcIso } from '../common/time.js';
import { DB, type Db } from '../database/database.js';
import {
  ANTHROPIC_MODELS,
  anthropicSettingsSchema,
  resolveAnthropicSettings,
} from './anthropic/anthropic.settings.js';
import { OPENAI_MODELS, openAiSettingsSchema, resolveOpenAiSettings } from './openai/openai.settings.js';

// Settings resolve in three layers: built-in defaults < environment variables <
// overrides saved from the settings UI. Secrets never enter this service's
// output: API keys stay in the environment and are reported only as set/unset.

export const harnessSettingsSchema = z
  .object({
    activeProvider: z.enum(['anthropic', 'openai']).default('anthropic'),
    /** Used when the active provider errors or is unreachable. */
    fallbackProvider: z.enum(['anthropic', 'openai', 'none']).default('openai'),
    /** Model calls per patient message before the bot stops and hands off. */
    maxToolIterations: z.number().int().min(1).max(16).default(8),
    /** Most recent stored items replayed to the model each turn. */
    historyLimit: z.number().int().min(4).max(400).default(80),
  })
  .strict();

const SCHEMAS = {
  harness: harnessSettingsSchema,
  anthropic: anthropicSettingsSchema,
  openai: openAiSettingsSchema,
} as const;

type Section = keyof typeof SCHEMAS;
export type HarnessSettings = z.infer<typeof harnessSettingsSchema>;
export type LlmSettings = { [K in Section]: z.infer<(typeof SCHEMAS)[K]> };
type Overrides = { [K in Section]?: Record<string, unknown> };
type Source = 'default' | 'env' | 'override';

const ENV_PREFIX: Record<Section, string> = { harness: 'LLM_', anthropic: 'ANTHROPIC_', openai: 'OPENAI_' };

/** camelCase key → ENV name, e.g. anthropic.maxTokens → ANTHROPIC_MAX_TOKENS. */
export const envName = (section: Section, key: string): string =>
  ENV_PREFIX[section] + key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase();

function parseEnvValue(raw: string): unknown {
  const v = raw.trim();
  if (v === 'true' || v === 'false') return v === 'true';
  if (v === 'null' || v === '') return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v.startsWith('[')) {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}

@Injectable()
export class LlmSettingsService {
  private readonly logger = new Logger('LlmSettings');

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Effective, validated settings. Invalid env values are reported and skipped, never fatal. */
  get(): LlmSettings {
    return this.build().settings;
  }

  /** Everything the settings UI needs: values, where each came from, model rules, warnings. */
  describe() {
    const { settings, sources } = this.build();
    const anthropic = resolveAnthropicSettings(settings.anthropic);
    const openai = resolveOpenAiSettings(settings.openai);
    return {
      settings,
      sources,
      keys: {
        anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
        openai: Boolean(process.env.OPENAI_API_KEY),
      },
      effective: {
        anthropic: { effort: anthropic.effort, warnings: anthropic.warnings },
        openai: { effort: openai.effort, warnings: openai.warnings },
      },
      models: { anthropic: ANTHROPIC_MODELS, openai: OPENAI_MODELS },
      envNames: Object.fromEntries(
        (Object.keys(SCHEMAS) as Section[]).map((s) => [s, Object.fromEntries(Object.keys(settings[s]).map((k) => [k, envName(s, k)]))]),
      ),
    };
  }

  /** Merges a partial change into the saved overrides after validating the result. */
  update(patch: Overrides): LlmSettings {
    const overrides = this.loadOverrides();
    for (const section of Object.keys(patch) as Section[]) {
      if (!(section in SCHEMAS)) throw new ValidationError(`Unknown settings section "${section}"`);
      const next = { ...(overrides[section] ?? {}), ...patch[section] };
      for (const [k, v] of Object.entries(next)) if (v === undefined) delete next[k];
      overrides[section] = next;
    }
    const merged = this.merge(overrides);
    for (const section of Object.keys(SCHEMAS) as Section[]) {
      const result = SCHEMAS[section].safeParse(merged.values[section]);
      if (!result.success) {
        throw new ValidationError(`${section}: ${result.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
      }
    }
    this.db
      .prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES ('llm', ?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(JSON.stringify(overrides), toUtcIso(this.clock.now()));
    return this.get();
  }

  /** Drops saved overrides for one section (or all), falling back to env + defaults. */
  reset(section?: Section): LlmSettings {
    const overrides = section ? { ...this.loadOverrides(), [section]: undefined } : {};
    this.db
      .prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES ('llm', ?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(JSON.stringify(overrides), toUtcIso(this.clock.now()));
    return this.get();
  }

  private build(): { settings: LlmSettings; sources: Record<Section, Record<string, Source>> } {
    const merged = this.merge(this.loadOverrides());
    const settings = {} as LlmSettings;
    for (const section of Object.keys(SCHEMAS) as Section[]) {
      const result = SCHEMAS[section].safeParse(merged.values[section]);
      if (result.success) {
        (settings as Record<Section, unknown>)[section] = result.data;
        continue;
      }
      // Drop the offending keys one by one so one bad env var can't take the bot down.
      const values = { ...merged.values[section] };
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        this.logger.warn(`Ignoring ${section}.${key}: ${issue.message}`);
        delete values[key];
        merged.sources[section][key] = 'default';
      }
      (settings as Record<Section, unknown>)[section] = SCHEMAS[section].parse(values);
    }
    for (const section of Object.keys(SCHEMAS) as Section[]) {
      for (const key of Object.keys(settings[section])) merged.sources[section][key] ??= 'default';
    }
    return { settings, sources: merged.sources };
  }

  private merge(overrides: Overrides) {
    const values = {} as Record<Section, Record<string, unknown>>;
    const sources = {} as Record<Section, Record<string, Source>>;
    for (const section of Object.keys(SCHEMAS) as Section[]) {
      values[section] = {};
      sources[section] = {};
      for (const key of Object.keys(SCHEMAS[section].shape)) {
        const raw = process.env[envName(section, key)];
        if (raw !== undefined && raw.trim() !== '') {
          values[section][key] = parseEnvValue(raw);
          sources[section][key] = 'env';
        }
      }
      for (const [key, value] of Object.entries(overrides[section] ?? {})) {
        values[section][key] = value;
        sources[section][key] = 'override';
      }
    }
    return { values, sources };
  }

  private loadOverrides(): Overrides {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = 'llm'").get() as { value: string } | undefined;
    if (!row) return {};
    try {
      return JSON.parse(row.value) as Overrides;
    } catch {
      this.logger.warn('Saved LLM settings were unreadable; using env + defaults');
      return {};
    }
  }
}
