import { Controller, Get, Query } from '@nestjs/common';
import { ValidationError } from '../common/errors.js';
import { FeedbackService } from './feedback.service.js';

/** Patient thumbs-up/down ratings for the staff Feedback view. Open, like the alert queue. */
@Controller('staff/feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get()
  list(@Query('rating') rating?: string) {
    if (rating !== undefined && rating !== '1' && rating !== '-1') {
      throw new ValidationError(`Unknown rating "${rating}" (use 1 or -1, or omit it for all)`);
    }
    return this.feedback.list(rating === undefined ? undefined : rating === '1' ? 1 : -1);
  }
}
