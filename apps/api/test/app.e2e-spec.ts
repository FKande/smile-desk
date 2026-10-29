import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('HTTP API (e2e)', () => {
  let app: INestApplication<App>;
  const saved = { admin: process.env.ADMIN_TOKEN, key: process.env.ANTHROPIC_API_KEY };

  beforeEach(async () => {
    process.env.ADMIN_TOKEN = 'test-admin-token';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-e2e-secret';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
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

  it('POST /chat with an unknown conversation id is a 404', async () => {
    const res = await request(app.getHttpServer()).post('/chat').send({ conversationId: 'conv_nope', message: 'hi' }).expect(404);
    expect(res.body.error).toBe('not_found');
  });

  it('admin routes require the token and never return secrets', async () => {
    await request(app.getHttpServer()).get('/admin/llm').expect(401);
    await request(app.getHttpServer()).get('/staff/notifications').set('x-admin-token', 'wrong').expect(401);

    const res = await request(app.getHttpServer()).get('/admin/llm').set('x-admin-token', 'test-admin-token').expect(200);
    expect(res.body.keys.anthropic).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('sk-ant-e2e-secret');
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
