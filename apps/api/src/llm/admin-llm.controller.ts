import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AdminTokenGuard } from '../common/admin-token.guard.js';
import { ValidationError } from '../common/errors.js';
import { parseBody } from '../common/zod-body.js';
import { LlmSettingsService } from './llm-settings.service.js';

const SECTIONS = ['harness', 'anthropic', 'openai'] as const;
const patchBody = z.object(Object.fromEntries(SECTIONS.map((s) => [s, z.record(z.string(), z.unknown()).optional()]))).strict();

/** Live settings API (/admin/llm): read every knob with its source, change any of them live, or reset. */
@Controller('admin/llm')
@UseGuards(AdminTokenGuard)
export class AdminLlmController {
  constructor(private readonly settings: LlmSettingsService) {}

  @Get()
  get() {
    return this.settings.describe();
  }

  @Put()
  update(@Body() body: unknown) {
    this.settings.update(parseBody(patchBody, body));
    return this.settings.describe();
  }

  @Delete(':section')
  reset(@Param('section') section: string) {
    if (section !== 'all' && !(SECTIONS as readonly string[]).includes(section)) {
      throw new ValidationError(`Unknown section "${section}" (use harness, anthropic, openai or all)`);
    }
    this.settings.reset(section === 'all' ? undefined : (section as (typeof SECTIONS)[number]));
    return this.settings.describe();
  }
}
