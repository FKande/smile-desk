import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DomainErrorFilter } from './common/domain-error.filter.js';
import { ConversationModule } from './conversation/conversation.module.js';
import { DatabaseModule } from './database/database.module.js';
import { FeedbackModule } from './feedback/feedback.module.js';
import { HealthController } from './health.controller.js';
import { LlmModule } from './llm/llm.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PatientsModule } from './patients/patients.module.js';
import { SchedulingModule } from './scheduling/scheduling.module.js';

@Module({
  imports: [
    // Per-client request ceiling; /chat sets a tighter limit of its own.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    DatabaseModule,
    PatientsModule,
    SchedulingModule,
    NotificationsModule,
    LlmModule,
    ConversationModule,
    FeedbackModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: DomainErrorFilter },
  ],
})
export class AppModule {}
