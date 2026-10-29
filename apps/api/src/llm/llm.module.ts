import { Module } from '@nestjs/common';
import { AdminLlmController } from './admin-llm.controller.js';
import { AnthropicProvider } from './anthropic/anthropic.provider.js';
import { LlmRouterService } from './llm-router.service.js';
import { LlmSettingsService } from './llm-settings.service.js';
import { OpenAiProvider } from './openai/openai.provider.js';

@Module({
  providers: [LlmSettingsService, AnthropicProvider, OpenAiProvider, LlmRouterService],
  controllers: [AdminLlmController],
  exports: [LlmSettingsService, LlmRouterService],
})
export class LlmModule {}
