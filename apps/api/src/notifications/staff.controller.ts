import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ValidationError } from '../common/errors.js';
import { NotificationsService } from './notifications.service.js';

/**
 * The office team's alert queue (emergencies, hand-offs, callbacks). Open in this demo so a
 * reviewer can watch alerts land; production puts it behind staff SSO. /admin/llm keeps its token.
 */
@Controller('staff/notifications')
export class StaffController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Query('status') status?: string) {
    if (status !== undefined && status !== 'open' && status !== 'acknowledged') {
      throw new ValidationError(`Unknown status "${status}" (use open or acknowledged, or omit it for all)`);
    }
    return this.notifications.list(status);
  }

  @Post(':id/acknowledge')
  acknowledge(@Param('id') id: string) {
    return this.notifications.acknowledge(id);
  }
}
