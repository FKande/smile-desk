import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { StaffController } from './staff.controller.js';

@Module({
  providers: [NotificationsService],
  controllers: [StaffController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
