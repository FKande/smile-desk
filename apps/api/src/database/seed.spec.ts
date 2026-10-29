import { DateTime } from 'luxon';
import { PRACTICE } from '../practice/practice.js';
import { TEST_NOW } from '../testing/test-context.js';
import { type Db, openDatabase } from './database.js';
import { SEED_WEEKS, seed, topUp } from './seed.js';

const today = TEST_NOW.startOf('day');
const nowIso = TEST_NOW.toUTC().toISO()!;

const lastSlotStart = (db: Db): DateTime =>
  DateTime.fromISO((db.prepare('SELECT MAX(start_at) AS last FROM slots').get() as { last: string }).last, { zone: PRACTICE.timezone });

const count = (db: Db, sql: string, ...params: unknown[]): number =>
  (db.prepare(`SELECT COUNT(*) AS n FROM (${sql})`).get(...params) as { n: number }).n;

const futureOccupancy = (db: Db, fromIso: string, toIso: string): number => {
  const total = count(db, 'SELECT id FROM slots WHERE emergency_hold = 0 AND start_at >= ? AND start_at < ?', fromIso, toIso);
  const booked = count(db, `SELECT s.id FROM slots s JOIN appointments a ON a.slot_id = s.id AND a.status = 'booked'
    WHERE s.emergency_hold = 0 AND s.start_at >= ? AND s.start_at < ?`, fromIso, toIso);
  return booked / total;
};

const allAppointments = (db: Db) => db.prepare('SELECT * FROM appointments ORDER BY id').all();

function sixWeekDb(): Db {
  const db = openDatabase(':memory:');
  seed(db, TEST_NOW, { weeks: 6 });
  return db;
}

describe('demo seed', () => {
  it('seeds about seven months of slots on a fresh database', () => {
    const db = openDatabase(':memory:');
    seed(db, TEST_NOW);
    const last = lastSlotStart(db);
    expect(last >= today.plus({ weeks: SEED_WEEKS - 1 })).toBe(true);
    expect(last < today.plus({ weeks: SEED_WEEKS })).toBe(true);
    expect(SEED_WEEKS * 7).toBeGreaterThanOrEqual(7 * 30);
  });

  it('thins bookings out further ahead, without leaving the far future empty', () => {
    const db = openDatabase(':memory:');
    seed(db, TEST_NOW);
    const iso = (d: DateTime) => d.toUTC().toISO()!;
    const far = futureOccupancy(db, iso(today.plus({ months: 4 })), iso(today.plus({ months: 7 })));
    expect(far).toBeGreaterThan(0.2);
    expect(far).toBeLessThan(0.4);
  });
});

describe('topUp', () => {
  it('extends a six-week database to seven months without touching existing appointments', () => {
    const db = sixWeekDb();
    const before = allAppointments(db);
    const lastBefore = lastSlotStart(db);
    expect(lastBefore < today.plus({ weeks: 6 })).toBe(true);

    const added = topUp(db, TEST_NOW);

    expect(added.slots).toBeGreaterThan(0);
    expect(added.bookings).toBeGreaterThan(0);
    expect(added.patients).toBeGreaterThanOrEqual(25);
    expect(added.pastVisits).toBeGreaterThan(0);
    expect(lastSlotStart(db) >= today.plus({ weeks: SEED_WEEKS - 1 })).toBe(true);

    // Every pre-existing appointment is still there, byte for byte.
    const byId = new Map((allAppointments(db) as { id: string }[]).map((a) => [a.id, a]));
    for (const a of before as { id: string }[]) expect(byId.get(a.id)).toEqual(a);

    // Only the new weeks got filler bookings, at a believable rate.
    const newFrom = lastBefore.plus({ minutes: 1 }).toUTC().toISO()!;
    const newBooked = count(db, `SELECT a.id FROM appointments a JOIN slots s ON s.id = a.slot_id
      WHERE a.status = 'booked' AND s.start_at < ? AND a.id LIKE 'appt_fill_%'`, newFrom);
    expect(newBooked).toBe(0);
    const occupancy = futureOccupancy(db, newFrom, '9999');
    expect(occupancy).toBeGreaterThan(0.25);
    expect(occupancy).toBeLessThan(0.5);
  });

  it('adds nothing when run again', () => {
    const db = sixWeekDb();
    topUp(db, TEST_NOW);
    const appointments = allAppointments(db);
    expect(topUp(db, TEST_NOW)).toEqual({ patients: 0, slots: 0, bookings: 0, pastVisits: 0 });
    expect(allAppointments(db)).toEqual(appointments);
  });

  it('keeps past visits stable on a later boot', () => {
    const db = sixWeekDb();
    topUp(db, TEST_NOW);
    const later = topUp(db, TEST_NOW.plus({ days: 3 }));
    expect(later.pastVisits).toBe(0);
    expect(later.patients).toBe(0);
    // Three days later the calendar rolls forward by those days only.
    expect(later.slots).toBeGreaterThan(0);
    expect(later.slots).toBeLessThanOrEqual(3 * 54);
  });

  it('books the follow-up history as completed cleanings five to six months ago', () => {
    const db = sixWeekDb();
    topUp(db, TEST_NOW);
    const rows = db.prepare(`SELECT a.patient_id, a.type, a.status, s.start_at FROM appointments a
      JOIN slots s ON s.id = a.slot_id WHERE a.id LIKE 'appt_hist_%'`).all() as
      { patient_id: string; type: string; status: string; start_at: string }[];
    expect(rows.length).toBeGreaterThanOrEqual(6);
    for (const r of rows) {
      expect(r).toMatchObject({ type: 'cleaning', status: 'completed' });
      const monthsAgo = TEST_NOW.diff(DateTime.fromISO(r.start_at), 'months').months;
      expect(monthsAgo).toBeGreaterThan(4.9);
      expect(monthsAgo).toBeLessThan(6.1);
    }
  });

  it('adds demo patients with valid phones, guardians for minors and a self-pay mix', () => {
    const db = sixWeekDb();
    topUp(db, TEST_NOW);
    const patients = db.prepare('SELECT * FROM patients').all() as
      { id: string; last_name: string; phone: string; insurance_name: string | null; guardian_id: string | null; date_of_birth: string }[];
    for (const p of patients) expect(p.phone).toMatch(/^\d{10}$/);
    expect(patients.some((p) => /[-é]/.test(p.last_name))).toBe(true);
    const minors = patients.filter((p) => !p.id.startsWith('pat_filler') && TEST_NOW.diff(DateTime.fromISO(p.date_of_birth), 'years').years < 18);
    for (const m of minors) expect(m.guardian_id).not.toBeNull();
    const insurers = new Set(patients.map((p) => p.insurance_name));
    for (const plan of ['Delta Dental', 'Aetna', 'Cigna', 'MetLife', 'Guardian', 'UnitedHealthcare', 'Humana', null]) {
      expect(insurers.has(plan)).toBe(true);
    }
  });

  it('never leaves a slot with two booked appointments', () => {
    const db = sixWeekDb();
    topUp(db, TEST_NOW);
    topUp(db, TEST_NOW.plus({ weeks: 2 }));
    expect(count(db, `SELECT slot_id FROM appointments WHERE status = 'booked' GROUP BY slot_id HAVING COUNT(*) > 1`)).toBe(0);
    expect(count(db, `SELECT a.id FROM appointments a JOIN slots s ON s.id = a.slot_id
      WHERE a.status = 'booked' AND s.emergency_hold = 1 AND a.id LIKE 'appt_fill_%'`)).toBe(0);
    expect(count(db, `SELECT a.id FROM appointments a JOIN slots s ON s.id = a.slot_id
      WHERE a.id LIKE 'appt_fill_%' AND s.start_at <= ?`, nowIso)).toBe(0);
  });
});
