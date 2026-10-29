import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { AnthropicProvider } from './../src/llm/anthropic/anthropic.provider.js';
import type { TurnRequest, TurnResult } from './../src/llm/llm.types.js';
import { OpenAiProvider } from './../src/llm/openai/openai.provider.js';

// Stand-in model: streams a fixed reply in three deltas, never touches the network.
const fakeModel = {
  name: 'anthropic' as const,
  isConfigured: () => true,
  async runTurn(request: TurnRequest): Promise<TurnResult> {
    for (const part of ['Hi, ', "I'm ", 'Maya.']) request.onTextDelta?.(part);
    return {
      provider: 'anthropic',
      model: 'fake',
      text: "Hi, I'm Maya.",
      toolCalls: [],
      native: null,
      stopReason: 'end',
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      warnings: [],
    };
  },
};

/** Parses an SSE body into [event, data] pairs (comment frames skipped). */
const parseSse = (body: string) =>
  body
    .split('\n\n')
    .filter((frame) => frame.startsWith('event:'))
    .map((frame) => {
      const [eventLine, dataLine] = frame.split('\n');
      return [eventLine.slice('event: '.length), JSON.parse(dataLine.slice('data: '.length))] as const;
    });

describe('HTTP API (e2e)', () => {
  let app: INestApplication<App>;
  const saved = { admin: process.env.ADMIN_TOKEN, key: process.env.ANTHROPIC_API_KEY };

  beforeEach(async () => {
    process.env.ADMIN_TOKEN = 'test-admin-token';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-e2e-secret';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AnthropicProvider)
      .useValue(fakeModel)
      .overrideProvider(OpenAiProvider)
      .useValue({ name: 'openai', isConfigured: () => false, runTurn: () => Promise.reject(new Error('unused')) })
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    process.env.ADMIN_TOKEN = saved.admin;
    process.env.ANTHROPIC_API_KEY = saved.key;
  });

  it('GET /health reports which providers have keys', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', activeProvider: 'anthropic', keys: { anthropic: true } });
  });

  it('POST /chat rejects empty or oversized messages', async () => {
    await request(app.getHttpServer()).post('/chat').send({ message: '' }).expect(400);
    await request(app.getHttpServer()).post('/chat').send({ message: 'x'.repeat(2001) }).expect(400);
  });

  it('POST /chat/stream streams the reply as server-sent events', async () => {
    const res = await request(app.getHttpServer()).post('/chat/stream').send({ message: 'hello' }).expect(200);
    expect(res.headers['content-type']).toContain('text/event-stream');

    const events = parseSse(res.text);
    expect(events.map(([name]) => name)).toEqual(['start', 'delta', 'delta', 'delta', 'done']);
    expect(events.filter(([n]) => n === 'delta').map(([, d]) => d.text).join('')).toBe("Hi, I'm Maya.");
    const [, done] = events[events.length - 1];
    expect(done).toMatchObject({ reply: "Hi, I'm Maya.", degraded: false, conversationId: events[0][1].conversationId });

    // The streamed conversation is a normal conversation afterwards.
    const history = await request(app.getHttpServer()).get(`/chat/${done.conversationId}/messages`).expect(200);
    // ...and its history restores the same reply, cards and flags the stream ended with.
    expect(history.body).toEqual([
      { role: 'patient', text: 'hello' },
      { role: 'assistant', text: done.reply, appointments: done.appointments, escalated: done.escalated, degraded: done.degraded, at: expect.any(String) },
    ]);
  });

  it('POST /chat/stream answers bad input with plain JSON before streaming', async () => {
    const empty = await request(app.getHttpServer()).post('/chat/stream').send({ message: '' }).expect(400);
    expect(empty.headers['content-type']).toContain('application/json');
    await request(app.getHttpServer()).post('/chat/stream').send({ conversationId: 'conv_nope', message: 'hi' }).expect(404);
  });

  it('POST /chat with an unknown conversation id is a 404', async () => {
    const res = await request(app.getHttpServer()).post('/chat').send({ conversationId: 'conv_nope', message: 'hi' }).expect(404);
    expect(res.body.error).toBe('not_found');
  });

  it('admin routes require the token and never return secrets', async () => {
    await request(app.getHttpServer()).get('/admin/llm').expect(401);
    await request(app.getHttpServer()).get('/admin/llm').set('x-admin-token', 'wrong').expect(401);

    const res = await request(app.getHttpServer()).get('/admin/llm').set('x-admin-token', 'test-admin-token').expect(200);
    expect(res.body.keys.anthropic).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('sk-ant-e2e-secret');
  });

  it('staff routes are open and reject unknown ids and filters with 404 / 400', async () => {
    const server = app.getHttpServer();
    await request(server).get('/staff/notifications').expect(200);
    await request(server).post('/staff/notifications/ntf_nope/acknowledge').expect(404);
    await request(server).get('/staff/notifications?status=bogus').expect(400);
    await request(server).get('/staff/notifications?status=open').expect(200);
  });

  it('PUT /admin/llm validates and applies changes live', async () => {
    const server = app.getHttpServer();
    await request(server).put('/admin/llm').set('x-admin-token', 'test-admin-token').send({ anthropic: { maxTokens: 1 } }).expect(400);
    const res = await request(server)
      .put('/admin/llm')
      .set('x-admin-token', 'test-admin-token')
      .send({ anthropic: { model: 'claude-sonnet-5-5', effort: 'low' } })
      .expect(200);
    expect(res.body.settings.anthropic).toMatchObject({ model: 'claude-sonnet-5-5', effort: 'low' });
    expect(res.body.sources.anthropic.model).toBe('override');
  });
});
