import { DateTime } from 'luxon';
import {
  ConflictError,
  ForbiddenError,
  SlotUnavailableError,
  ValidationError,
} from '../common/errors.js';
import { createTestContext, TEST_NOW, type TestContext } from '../testing/test-context.js';

const SARAH = 'pat_sarah_johnson';
const MICHAEL = 'pat_michael_johnson';
const EMMA = 'pat_emma_johnson';
const MARIA = 'pat_maria_garcia';
const ROBERT = 'pat_robert_williams';

const fromNow = (days: number) => TEST_NOW.plus({ days }).toISODate()!;

describe('SchedulingService', () => {
  let ctx: TestContext;
  beforeEach(() => {
    ctx = createTestContext();
  });

  describe('findOpenSlots', () => {
    it('returns future, unbooked slots for the right provider role, in time order', () => {
      const slots = ctx.scheduling.findOpenSlots({ type: 'cleaning', limit: 10 });
      expect(slots.length).toBeGreaterThan(0);
      expect(slots.every((s) => s.providerRole === 'hygienist')).toBe(true);
      const starts = slots.map((s) => DateTime.fromISO(s.start));
      expect(starts.every((s) => s > TEST_NOW)).toBe(true);
      expect(starts).toEqual([...starts].sort((a, b) => a.toMillis() - b.toMillis()));
    });

    it('keeps emergency holds away from routine visits but offers them for emergencies', () => {
      const holdIds = (ctx.db.prepare('SELECT id FROM slots WHERE emergency_hold = 1').all() as { id: string }[]).map((r) => r.id);
      const routine = ctx.scheduling.findOpenSlots({ type: 'checkup', limit: 20, maxPerDay: 20, to: fromNow(3) });
      const emergency = ctx.scheduling.findOpenSlots({ type: 'emergency', limit: 20, maxPerDay: 20, to: fromNow(3) });
      expect(routine.some((s) => holdIds.includes(s.slotId))).toBe(false);
      expect(emergency.some((s) => holdIds.includes(s.slotId))).toBe(true);
    });

    it('filters by part of day in practice time', () => {
      const slots = ctx.scheduling.findOpenSlots({ type: 'checkup', partOfDay: 'afternoon', limit: 10 });
      expect(slots.length).toBeGreaterThan(0);
      expect(slots.every((s) => DateTime.fromISO(s.start, { setZone: true }).hour >= 12)).toBe(true);
      expect(slots.every((s) => DateTime.fromISO(s.start, { setZone: true }).hour < 16)).toBe(true);
    });

    it('spreads results across days and never repeats a start time', () => {
      const slots = ctx.scheduling.findOpenSlots({ type: 'checkup', limit: 10, maxPerDay: 2 });
      const perDay = new Map<string, number>();
      for (const s of slots) perDay.set(s.start.slice(0, 10), (perDay.get(s.start.slice(0, 10)) ?? 0) + 1);
      expect(Math.max(...perDay.values())).toBeLessThanOrEqual(2);
      expect(new Set(slots.map((s) => s.start)).size).toBe(slots.length);
    });

    it('returns nothing for routine visits on the fully booked Saturday', () => {
      const saturday = TEST_NOW.plus({ days: 7 }).set({ weekday: 6 }).startOf('day');
      const slots = ctx.scheduling.findOpenSlots({
        type: 'cleaning',
        from: saturday.toISO()!,
        to: saturday.plus({ days: 1 }).toISO()!,
      });
      expect(slots).toEqual([]);
    });

    it('rejects nonsense windows and unknown types', () => {
      expect(() => ctx.scheduling.findOpenSlots({ type: 'cleaning', from: fromNow(5), to: fromNow(2) })).toThrow(ValidationError);
      expect(() => ctx.scheduling.findOpenSlots({ type: 'cleaning', to: fromNow(200) })).toThrow(ValidationError);
      expect(() => ctx.scheduling.findOpenSlots({ type: 'whitening' as never })).toThrow(ValidationError);
    });
  });

  describe('book', () => {
    const firstOpen = (type: 'cleaning' | 'checkup' | 'emergency') =>
      ctx.scheduling.findOpenSlots({ type, from: fromNow(2) })[0];

    it('books an open slot', () => {
      const slot = firstOpen('cleaning');
      const appt = ctx.scheduling.book({ patientId: MARIA, slotId: slot.slotId, type: 'cleaning' });
      expect(appt).toMatchObject({ patientId: MARIA, type: 'cleaning', status: 'booked', start: slot.start });
      expect(ctx.scheduling.findOpenSlots({ type: 'cleaning', from: fromNow(2) })[0].slotId).not.toBe(slot.slotId);
    });

    it('lets only one booking win a slot (database-enforced)', () => {
      const slot = firstOpen('checkup');
      ctx.scheduling.book({ patientId: MARIA, slotId: slot.slotId, type: 'checkup' });
      expect(() => ctx.scheduling.book({ patientId: ROBERT, slotId: slot.slotId, type: 'checkup' })).toThrow(SlotUnavailableError);
    });

    it('rejects a slot for the wrong provider role, a held slot, or a past slot', () => {
      const dentistSlot = firstOpen('checkup');
      expect(() => ctx.scheduling.book({ patientId: MARIA, slotId: dentistSlot.slotId, type: 'cleaning' })).toThrow(ValidationError);

      const hold = ctx.db.prepare("SELECT id FROM slots WHERE emergency_hold = 1 AND start_at > ? LIMIT 1").get(TEST_NOW.toUTC().toISO()) as { id: string };
      expect(() => ctx.scheduling.book({ patientId: MARIA, slotId: hold.id, type: 'checkup' })).toThrow(SlotUnavailableError);

      const past = ctx.db.prepare('SELECT id FROM slots WHERE start_at < ? LIMIT 1').get(TEST_NOW.toUTC().toISO()) as { id: string };
      expect(() => ctx.scheduling.book({ patientId: MARIA, slotId: past.id, type: 'checkup' })).toThrow(ValidationError);
    });

    it('requires a summary for emergencies and can use the emergency hold', () => {
      const slot = ctx.scheduling.findOpenSlots({ type: 'emergency' })[0];
      expect(() => ctx.scheduling.book({ patientId: MARIA, slotId: slot.slotId, type: 'emergency' })).toThrow(ValidationError);
      const appt = ctx.scheduling.book({ patientId: MARIA, slotId: slot.slotId, type: 'emergency', reason: 'Cracked molar, sharp pain' });
      expect(appt.reason).toBe('Cracked molar, sharp pain');
    });

    it('stops a patient from being in two chairs at once', () => {
      const [a] = ctx.scheduling.findOpenSlots({ type: 'checkup', from: fromNow(3), limit: 1 });
      const sameTime = ctx.db
        .prepare(`SELECT s.id FROM slots s WHERE s.start_at = ? AND s.id != ? AND s.provider_id IN ('prov_patel','prov_okafor')
                  AND NOT EXISTS (SELECT 1 FROM appointments x WHERE x.slot_id = s.id AND x.status = 'booked')`)
        .get(DateTime.fromISO(a.start).toUTC().toISO(), a.slotId) as { id: string } | undefined;
      ctx.scheduling.book({ patientId: MARIA, slotId: a.slotId, type: 'checkup' });
      if (sameTime) {
        expect(() => ctx.scheduling.book({ patientId: MARIA, slotId: sameTime.id, type: 'checkup' })).toThrow(ConflictError);
      }
    });

    it('is idempotent per request id', () => {
      const slot = firstOpen('cleaning');
      const first = ctx.scheduling.book({ patientId: MARIA, slotId: slot.slotId, type: 'cleaning' }, { requestId: 'req-1' });
      const retry = ctx.scheduling.book({ patientId: MARIA, slotId: slot.slotId, type: 'cleaning' }, { requestId: 'req-1' });
      expect(retry.appointmentId).toBe(first.appointmentId);
    });

    it('enforces who can book for whom', () => {
      const slot = firstOpen('cleaning');
      expect(() =>
        ctx.scheduling.book({ patientId: EMMA, slotId: slot.slotId, type: 'cleaning' }, { bookedById: MARIA }),
      ).toThrow(ForbiddenError);
      const appt = ctx.scheduling.book({ patientId: EMMA, slotId: slot.slotId, type: 'cleaning' }, { bookedById: SARAH });
      expect(appt.patientName).toBe('Emma Johnson');
    });
  });

  describe('family scheduling', () => {
    it('finds chains where each visit starts as the previous one ends', () => {
      const options = ctx.scheduling.findBackToBack({ types: ['cleaning', 'cleaning', 'checkup'] });
      expect(options.length).toBeGreaterThan(0);
      for (const chain of options) {
        expect(chain.map((s) => s.providerRole)).toEqual(['hygienist', 'hygienist', 'dentist']);
        for (let i = 1; i < chain.length; i++) {
          expect(DateTime.fromISO(chain[i].start).toMillis()).toBe(DateTime.fromISO(chain[i - 1].end).toMillis());
        }
      }
      const days = options.map((chain) => chain[0].start.slice(0, 10));
      expect(new Set(days).size).toBe(days.length);
    });

    it('books a whole family atomically: all or nothing', () => {
      const [chain] = ctx.scheduling.findBackToBack({ types: ['cleaning', 'cleaning'] });
      const taken = ctx.scheduling.findOpenSlots({ type: 'checkup', from: fromNow(4) })[0];
      ctx.scheduling.book({ patientId: ROBERT, slotId: taken.slotId, type: 'checkup' });

      expect(() =>
        ctx.scheduling.bookMany(
          [
            { patientId: SARAH, slotId: chain[0].slotId, type: 'cleaning' },
            { patientId: MICHAEL, slotId: taken.slotId, type: 'checkup' },
          ],
          { bookedById: SARAH },
        ),
      ).toThrow(SlotUnavailableError);
      expect(ctx.scheduling.upcoming([SARAH]).some((a) => a.start === chain[0].start)).toBe(false);

      const booked = ctx.scheduling.bookMany(
        [
          { patientId: SARAH, slotId: chain[0].slotId, type: 'cleaning' },
          { patientId: EMMA, slotId: chain[1].slotId, type: 'cleaning' },
        ],
        { bookedById: SARAH },
      );
      expect(booked.map((a) => a.patientName)).toEqual(['Sarah Johnson', 'Emma Johnson']);
    });

    it('refuses emergency visits in a group booking', () => {
      expect(() => ctx.scheduling.findBackToBack({ types: ['emergency', 'cleaning'] })).toThrow(ValidationError);
    });
  });

  describe('reschedule and cancel', () => {
    const sarahsCleaning = () => ctx.scheduling.upcoming([SARAH])[0];

    it('moves an appointment and frees the old slot', () => {
      const before = sarahsCleaning();
      const target = ctx.scheduling.findOpenSlots({ type: 'cleaning', from: fromNow(10) })[0];
      const after = ctx.scheduling.reschedule({ appointmentId: before.appointmentId, newSlotId: target.slotId, actorId: SARAH });
      expect(after.start).toBe(target.start);
      expect(after.appointmentId).toBe(before.appointmentId);
      const old = ctx.db.prepare("SELECT COUNT(*) AS n FROM appointments a JOIN slots s ON s.id = a.slot_id WHERE s.start_at = ? AND a.patient_id = ? AND a.status = 'booked'")
        .get(DateTime.fromISO(before.start).toUTC().toISO(), SARAH) as { n: number };
      expect(old.n).toBe(0);
    });

    it('will not move an appointment onto a taken slot', () => {
      const target = ctx.scheduling.findOpenSlots({ type: 'cleaning', from: fromNow(10) })[0];
      ctx.scheduling.book({ patientId: MARIA, slotId: target.slotId, type: 'cleaning' });
      expect(() =>
        ctx.scheduling.reschedule({ appointmentId: sarahsCleaning().appointmentId, newSlotId: target.slotId, actorId: SARAH }),
      ).toThrow(SlotUnavailableError);
    });

    it('lets the spouse manage it but not a stranger', () => {
      const appt = sarahsCleaning();
      expect(() => ctx.scheduling.cancel({ appointmentId: appt.appointmentId, actorId: MARIA })).toThrow(ForbiddenError);
      const cancelled = ctx.scheduling.cancel({ appointmentId: appt.appointmentId, actorId: MICHAEL, reason: 'Out of town' });
      expect(cancelled.status).toBe('cancelled');
      expect(() => ctx.scheduling.cancel({ appointmentId: appt.appointmentId, actorId: SARAH })).toThrow(ConflictError);
    });
  });
});
