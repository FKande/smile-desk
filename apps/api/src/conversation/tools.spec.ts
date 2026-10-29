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

  describe('end times', () => {
    it('gives the model when each offered slot and existing appointment ends', () => {
      const slots = JSON.parse(tools.execute('find_open_slots', { appointment_type: 'checkup', when: { period: 'next_week' } }, session()).output);
      expect(slots.options[0]).toMatchObject({ time: expect.any(String), ends: expect.stringMatching(/^\d{1,2}:\d{2} [AP]M$/) });

      const s = session();
      const verified = JSON.parse(tools.execute('verify_patient', { first_name: 'Robert', last_name: 'Williams', date_of_birth: '1948-01-15' }, s).output);
      const checkup = verified.upcoming_appointments[0];
      const minutes = (t: string) => {
        const [, h, m, ap] = t.match(/(\d{1,2}):(\d{2}) ([AP]M)/)!;
        return ((Number(h) % 12) + (ap === 'PM' ? 12 : 0)) * 60 + Number(m);
      };
      expect(minutes(checkup.ends) - minutes(checkup.time)).toBe(30); // checkups are 30 minutes
    });
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
