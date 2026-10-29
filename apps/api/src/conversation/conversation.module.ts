import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PatientsModule } from '../patients/patients.module.js';
import { SchedulingModule } from '../scheduling/scheduling.module.js';
import { ChatController } from './chat.controller.js';
import { ConversationService } from './conversation.service.js';

@Module({
  imports: [LlmModule, PatientsModule, SchedulingModule, NotificationsModule],
  providers: [ConversationService],
  controllers: [ChatController],
})
export class ConversationModule {}
