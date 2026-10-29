import { Controller, Get } from '@nestjs/common';
import { LlmSettingsService } from './llm/llm-settings.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly settings: LlmSettingsService) {}

  /** Liveness plus which providers are usable, without exposing any secret. */
  @Get()
  health() {
    const { harness } = this.settings.get();
    return {
      status: 'ok',
      activeProvider: harness.activeProvider,
      fallbackProvider: harness.fallbackProvider,
      keys: { anthropic: Boolean(process.env.ANTHROPIC_API_KEY), openai: Boolean(process.env.OPENAI_API_KEY) },
    };
  }
}
