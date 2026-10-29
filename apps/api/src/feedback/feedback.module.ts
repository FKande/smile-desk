import { Module } from '@nestjs/common';
import { FeedbackController } from './feedback.controller.js';
import { FeedbackService } from './feedback.service.js';

@Module({
  providers: [FeedbackService],
  controllers: [FeedbackController],
})
export class FeedbackModule {}
