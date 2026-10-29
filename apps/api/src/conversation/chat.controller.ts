import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { parseBody } from '../common/zod-body.js';
import { ConversationService, MAX_MESSAGE_LENGTH, type ChatReply } from './conversation.service.js';

const chatBody = z.object({
  conversationId: z.string().min(1).max(100).optional(),
  message: z.string().min(1).max(MAX_MESSAGE_LENGTH),
});

const feedbackBody = z.object({
  rating: z.union([z.literal(1), z.literal(-1)]),
  comment: z.string().max(1000).optional(),
});

@Controller('chat')
export class ChatController {
  constructor(private readonly conversations: ConversationService) {}

  /** One patient message in, the assistant's reply out. Omit conversationId to start a new chat. */
  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  send(@Body() body: unknown): Promise<ChatReply> {
    return this.conversations.handleMessage(parseBody(chatBody, body));
  }

  @Get(':conversationId/messages')
  messages(@Param('conversationId') conversationId: string) {
    return this.conversations.transcript(conversationId);
  }

  @Post(':conversationId/feedback')
  @HttpCode(204)
  feedback(@Param('conversationId') conversationId: string, @Body() body: unknown): void {
    const { rating, comment } = parseBody(feedbackBody, body);
    this.conversations.addFeedback(conversationId, rating, comment);
  }
}
