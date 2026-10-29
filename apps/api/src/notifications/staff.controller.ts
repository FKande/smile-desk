import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminTokenGuard } from '../common/admin-token.guard.js';
import { NotificationsService } from './notifications.service.js';

/** The office team's alert queue (emergencies, hand-offs, callbacks). */
@Controller('staff/notifications')
@UseGuards(AdminTokenGuard)
export class StaffController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.notifications.list(status === 'open' || status === 'acknowledged' ? status : undefined);
  }

  @Post(':id/acknowledge')
  acknowledge(@Param('id') id: string) {
    return this.notifications.acknowledge(id);
  }
}
