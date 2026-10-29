import { createTestContext, type TestContext } from '../testing/test-context.js';
import { buildTools, type ToolSession } from './tools.js';

describe('tools', () => {
  let ctx: TestContext;
  let tools: ReturnType<typeof buildTools>;
  const session = (): ToolSession => ({ conversationId: 'conv_test', turnId: 'msg_test', actorId: null, escalated: false, changedAppointments: [] });

  beforeEach(() => {
    ctx = createTestContext();
    tools = buildTools({ patients: ctx.patients, scheduling: ctx.scheduling, notifications: ctx.notifications, clock: ctx.clock });
  });

  describe('notify_staff', () => {
    const ask = { kind: 'escalation', urgency: 'normal', summary: 'Wants to talk to a person about a bill' };

    it('raises one alert per conversation and kind, even if the patient asks again', () => {
      const s = session();
      const first = JSON.parse(tools.execute('notify_staff', ask, s).output);
      const again = JSON.parse(tools.execute('notify_staff', { ...ask, summary: 'Asked again for a human' }, s).output);

      expect(first).toMatchObject({ notified: true });
      expect(again).toMatchObject({ notified: true, already_notified: true, reference: first.reference });
      expect(ctx.notifications.list('open')).toHaveLength(1);
      expect(s.escalated).toBe(true);
    });

    it('still alerts for a different kind, or once the earlier alert was handled', () => {
      const s = session();
      tools.execute('notify_staff', ask, s);
      tools.execute('notify_staff', { ...ask, kind: 'callback' }, s);
      expect(ctx.notifications.list('open')).toHaveLength(2);

      for (const n of ctx.notifications.list('open')) ctx.notifications.acknowledge(n.id);
      tools.execute('notify_staff', ask, s);
      expect(ctx.notifications.list('open')).toHaveLength(1);
    });
  });
});
