import { PRACTICE } from '../practice/practice.js';
import { createTestContext, type TestContext } from '../testing/test-context.js';
import { FEEDBACK_LIMIT, FeedbackService } from './feedback.service.js';

describe('FeedbackService', () => {
  let ctx: TestContext;
  let feedback: FeedbackService;

  const conversation = (id: string, patientId: string | null = null) =>
    ctx.db
      .prepare('INSERT INTO conversations (id, location_id, patient_id, started_at, last_message_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, PRACTICE.locationId, patientId, '2026-11-02T17:00:00.000Z', '2026-11-02T17:00:00.000Z');
  const message = (conversationId: string, role: 'user' | 'assistant', content: object, at = '2026-11-02T17:00:00.000Z') =>
    ctx.db
      .prepare('INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(`msg_${Math.random()}`, conversationId, role, JSON.stringify(content), at);
  const rate = (id: string, conversationId: string, rating: 1 | -1, createdAt: string, comment: string | null = null) =>
    ctx.db
      .prepare('INSERT INTO feedback (id, conversation_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, conversationId, rating, comment, createdAt);

  beforeEach(() => {
    ctx = createTestContext();
    feedback = new FeedbackService(ctx.db);
  });

  it('lists newest first with the verified patient name and the first patient message', () => {
    conversation('conv_a', 'pat_sarah_johnson');
    message('conv_a', 'user', { kind: 'user', text: 'Hi, I need a cleaning', context: '<context>secret dob</context>' });
    message('conv_a', 'assistant', { kind: 'assistant', text: 'Happy to help!' });
    message('conv_a', 'user', { kind: 'user', text: 'Thursday works', context: '' });
    conversation('conv_b');
    message('conv_b', 'user', { kind: 'user', text: 'Do you take Delta Dental?', context: '' });
    rate('fb_old', 'conv_a', 1, '2026-11-02T17:05:00.000Z', 'Quick and easy');
    rate('fb_new', 'conv_b', -1, '2026-11-02T18:00:00.000Z');

    expect(feedback.list()).toEqual([
      { id: 'fb_new', conversationId: 'conv_b', rating: -1, comment: null, createdAt: '2026-11-02T18:00:00.000Z', patientName: null, excerpt: 'Do you take Delta Dental?' },
      {
        id: 'fb_old',
        conversationId: 'conv_a',
        rating: 1,
        comment: 'Quick and easy',
        createdAt: '2026-11-02T17:05:00.000Z',
        patientName: 'Sarah Johnson',
        excerpt: 'Hi, I need a cleaning',
      },
    ]);
  });

  it('filters by rating', () => {
    conversation('conv_a');
    rate('fb_up', 'conv_a', 1, '2026-11-02T17:05:00.000Z');
    rate('fb_down', 'conv_a', -1, '2026-11-02T17:06:00.000Z');
    expect(feedback.list(-1).map((f) => f.id)).toEqual(['fb_down']);
    expect(feedback.list(1).map((f) => f.id)).toEqual(['fb_up']);
  });

  it('trims long excerpts, never leaks the context block, and copes with no patient message', () => {
    conversation('conv_long');
    message('conv_long', 'user', { kind: 'user', text: `  ${'word '.repeat(60)}`, context: 'DOB 1988-04-12' });
    conversation('conv_empty');
    rate('fb_long', 'conv_long', -1, '2026-11-02T17:05:00.000Z');
    rate('fb_empty', 'conv_empty', -1, '2026-11-02T17:04:00.000Z');

    const [long, empty] = feedback.list();
    expect(long.excerpt.length).toBeLessThanOrEqual(140);
    expect(long.excerpt.endsWith('…')).toBe(true);
    expect(long.excerpt).not.toContain('1988');
    expect(empty.excerpt).toBe('');
  });

  it(`returns at most ${FEEDBACK_LIMIT}`, () => {
    conversation('conv_a');
    for (let i = 0; i < FEEDBACK_LIMIT + 5; i++) rate(`fb_${i}`, 'conv_a', -1, `2026-11-02T17:${String(i).padStart(2, '0')}:00.000Z`);
    const list = feedback.list();
    expect(list).toHaveLength(FEEDBACK_LIMIT);
    expect(list[0].id).toBe(`fb_${FEEDBACK_LIMIT + 4}`);
  });
});
