import { Body, Controller, Get, HttpCode, Logger, Param, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { DomainError } from '../common/errors.js';
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

/** Comment frames keep proxies and load balancers from closing a quiet stream. */
const HEARTBEAT_MS = 15_000;

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger('ChatStream');

  constructor(private readonly conversations: ConversationService) {}

  /** One patient message in, the assistant's reply out. Omit conversationId to start a new chat. */
  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  send(@Body() body: unknown): Promise<ChatReply> {
    return this.conversations.handleMessage(parseBody(chatBody, body));
  }

  /**
   * Same as POST /chat, streamed as Server-Sent Events: start, delta*, (reset | step | tool)*,
   * then done with the final reply (or error). Bad input is still a plain 400/404 because it's
   * checked before the stream opens.
   */
  @Post('stream')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async stream(@Body() body: unknown, @Res() res: Response): Promise<void> {
    const input = parseBody(chatBody, body);
    this.conversations.validate(input);

    res.status(200).set({
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    res.flushHeaders();

    let open = true;
    res.on('close', () => (open = false));
    const send = (event: string, data: unknown) => {
      if (open) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const heartbeat = setInterval(() => open && res.write(': ping\n\n'), HEARTBEAT_MS);

    try {
      // The turn always runs to completion, even if the patient closes the tab:
      // a booking half-made by a dropped connection would be worse than an unread reply.
      const reply = await this.conversations.handleMessage(input, {
        start: (conversationId) => send('start', { conversationId }),
        delta: (text) => send('delta', { text }),
        reset: () => send('reset', {}),
        step: () => send('step', {}),
        tool: (name, label) => send('tool', { name, label }),
      });
      send('done', reply);
    } catch (err) {
      if (!(err instanceof DomainError)) this.logger.error(err instanceof Error ? err.stack : String(err));
      send('error', err instanceof DomainError ? { error: err.code, message: err.message } : { error: 'internal', message: 'Something went wrong. Please try again.' });
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
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
