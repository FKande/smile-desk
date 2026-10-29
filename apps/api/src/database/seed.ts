import { DateTime } from 'luxon';
import { toUtcIso } from '../common/time.js';
import {
  APPOINTMENT_TYPES,
  AppointmentType,
  PRACTICE,
  ProviderRole,
} from '../practice/practice.js';
import type { Db } from './database.js';

// Demo data is generated relative to "now" so there are always upcoming openings,
// and with a fixed PRNG seed so tests and demos see the same calendar.
//
// Two entry points:
// - seed(): builds a brand-new practice (only ever runs on an empty database).
// - topUp(): runs on every boot, fresh or existing. It only ever inserts what is missing
//   (by stable id), so a long-lived database keeps its real conversations and bookings
//   while the calendar keeps rolling forward.

interface SeedOptions {
  weeks: number;
  occupancy: number;
  randomSeed: number;
}

/** About seven months of capacity, so "early next spring" has real openings. */
export const SEED_WEEKS = 31;

const DEFAULTS: SeedOptions = { weeks: SEED_WEEKS, occupancy: 0.5, randomSeed: 42 };

const PROVIDERS: { id: string; name: string; role: ProviderRole }[] = [
  { id: 'prov_patel', name: 'Dr. Priya Patel', role: 'dentist' },
  { id: 'prov_okafor', name: 'Dr. James Okafor', role: 'dentist' },
  { id: 'prov_ruiz', name: 'Ana Ruiz, RDH', role: 'hygienist' },
  { id: 'prov_carter', name: 'Ben Carter, RDH', role: 'hygienist' },
];

const SLOT_MINUTES: Record<ProviderRole, number> = { dentist: 30, hygienist: 60 };

interface SeedPatient {
  id: string;
  first: string;
  last: string;
  dob: string;
  phone: string;
  insurance: string | null;
  household?: string;
  guardian?: string;
}

// Named patients exist to exercise specific flows in the demo and tests.
const NAMED_PATIENTS: SeedPatient[] = [
  // Family: two parents, two kids (guardian: Sarah). Family booking, guardian permissions.
  { id: 'pat_sarah_johnson', first: 'Sarah', last: 'Johnson', dob: '1988-04-12', phone: '4155550142', insurance: 'Delta Dental', household: 'hh_johnson' },
  { id: 'pat_michael_johnson', first: 'Michael', last: 'Johnson', dob: '1986-09-03', phone: '4155550143', insurance: 'Delta Dental', household: 'hh_johnson' },
  { id: 'pat_emma_johnson', first: 'Emma', last: 'Johnson', dob: '2016-02-20', phone: '4155550142', insurance: 'Delta Dental', household: 'hh_johnson', guardian: 'pat_sarah_johnson' },
  { id: 'pat_liam_johnson', first: 'Liam', last: 'Johnson', dob: '2019-07-08', phone: '4155550142', insurance: 'Delta Dental', household: 'hh_johnson', guardian: 'pat_sarah_johnson' },
  // Same name, different people: name alone must never identify a patient.
  { id: 'pat_david_chen_1975', first: 'David', last: 'Chen', dob: '1975-11-30', phone: '4155550177', insurance: 'Aetna' },
  { id: 'pat_david_chen_1992', first: 'David', last: 'Chen', dob: '1992-03-14', phone: '6285550110', insurance: 'Cigna' },
  // Self-pay patient.
  { id: 'pat_maria_garcia', first: 'Maria', last: 'Garcia', dob: '1995-06-21', phone: '4155550199', insurance: null },
  // Older patient (accessibility persona in the demo).
  { id: 'pat_robert_williams', first: 'Robert', last: 'Williams', dob: '1948-01-15', phone: '4155550123', insurance: 'MetLife' },
];

const FILLER_FIRST = ['Olivia', 'Noah', 'Ava', 'Ethan', 'Mia', 'Lucas', 'Zoe', 'Mateo', 'Chloe', 'Arjun', 'Grace', 'Leo'];
const FILLER_LAST = ['Nguyen', 'Brown', 'Kim', 'Lopez', 'Singh', 'Miller', 'Davis', 'Wilson', 'Moore', 'Ali', 'Clark', 'Young'];

// Upcoming visits for named patients: [patient, type, days from today, preferred local hour].
const NAMED_APPOINTMENTS: [string, AppointmentType, number, number][] = [
  ['pat_sarah_johnson', 'cleaning', 5, 10],
  ['pat_robert_williams', 'checkup', 3, 9],
  ['pat_maria_garcia', 'checkup', 8, 14],
  ['pat_david_chen_1975', 'cleaning', 12, 15],
];

// The wider patient roster, added by topUp() so existing databases gain it too. Surnames
// and phones don't overlap the named patients above, so their lookups stay unambiguous.
// Guardians are listed before their minors (foreign key on guardian_id).
const DEMO_HOUSEHOLDS: [string, string][] = [
  ['hh_rossi', 'Rossi family'],
  ['hh_washington', 'Washington family'],
  ['hh_oconnor', "O'Connor family"],
];

const DEMO_PATIENTS: SeedPatient[] = [
  // Couple with a teenager (minor: guardian Elena).
  { id: 'pat_marco_rossi', first: 'Marco', last: 'Rossi', dob: '1979-05-14', phone: '5105550181', insurance: 'Guardian', household: 'hh_rossi' },
  { id: 'pat_elena_rossi', first: 'Elena', last: 'Rossi', dob: '1981-10-02', phone: '5105550182', insurance: 'Guardian', household: 'hh_rossi' },
  { id: 'pat_sofia_rossi', first: 'Sofia', last: 'Rossi', dob: '2010-03-27', phone: '5105550183', insurance: 'Guardian', household: 'hh_rossi', guardian: 'pat_elena_rossi' },
  // Single parent with two kids, sharing her phone.
  { id: 'pat_keisha_washington', first: 'Keisha', last: 'Washington', dob: '1987-08-19', phone: '5105550190', insurance: 'Cigna', household: 'hh_washington' },
  { id: 'pat_jaylen_washington', first: 'Jaylen', last: 'Washington', dob: '2014-01-11', phone: '5105550190', insurance: 'Cigna', household: 'hh_washington', guardian: 'pat_keisha_washington' },
  { id: 'pat_amara_washington', first: 'Amara', last: 'Washington', dob: '2018-06-30', phone: '5105550190', insurance: 'Cigna', household: 'hh_washington', guardian: 'pat_keisha_washington' },
  // Older couple.
  { id: 'pat_patrick_oconnor', first: 'Patrick', last: "O'Connor", dob: '1951-03-08', phone: '6505550131', insurance: 'Humana', household: 'hh_oconnor' },
  { id: 'pat_margaret_oconnor', first: 'Margaret', last: "O'Connor", dob: '1953-12-01', phone: '6505550132', insurance: 'Humana', household: 'hh_oconnor' },
  // Hyphenated and accented names.
  { id: 'pat_jose_hernandez_ramirez', first: 'José', last: 'Hernández-Ramírez', dob: '1990-09-17', phone: '6505550144', insurance: 'UnitedHealthcare' },
  { id: 'pat_chloe_dubois', first: 'Chloé', last: 'Dubois', dob: '1997-04-05', phone: '6505550145', insurance: 'MetLife' },
  // Self-pay.
  { id: 'pat_tyler_brooks', first: 'Tyler', last: 'Brooks', dob: '2000-02-29', phone: '9255550110', insurance: null },
  { id: 'pat_fatima_rahman', first: 'Fatima', last: 'Rahman', dob: '1984-11-23', phone: '9255550111', insurance: null },
  { id: 'pat_dmitri_volkov', first: 'Dmitri', last: 'Volkov', dob: '1972-07-04', phone: '9255550112', insurance: null },
  // Due for their six-month follow-up (see DEMO_HISTORY).
  { id: 'pat_hannah_schmidt', first: 'Hannah', last: 'Schmidt', dob: '1993-01-28', phone: '4085550160', insurance: 'Guardian' },
  { id: 'pat_kenji_tanaka', first: 'Kenji', last: 'Tanaka', dob: '1983-06-12', phone: '4085550161', insurance: 'Delta Dental' },
  { id: 'pat_aisha_bello', first: 'Aisha', last: 'Bello', dob: '1991-09-09', phone: '4085550162', insurance: 'MetLife' },
  { id: 'pat_samuel_osei', first: 'Samuel', last: 'Osei', dob: '1977-02-16', phone: '4085550163', insurance: 'Aetna' },
  { id: 'pat_laura_bennett', first: 'Laura', last: 'Bennett', dob: '1969-12-03', phone: '4085550164', insurance: 'UnitedHealthcare' },
  // Everyone else.
  { id: 'pat_rachel_goldberg', first: 'Rachel', last: 'Goldberg', dob: '1985-03-19', phone: '7075550120', insurance: 'Aetna' },
  { id: 'pat_wei_zhang', first: 'Wei', last: 'Zhang', dob: '1998-10-30', phone: '7075550121', insurance: 'Cigna' },
  { id: 'pat_isabella_martinez', first: 'Isabella', last: 'Martinez', dob: '2003-05-22', phone: '7075550122', insurance: 'Humana' },
  { id: 'pat_omar_haddad', first: 'Omar', last: 'Haddad', dob: '1980-08-08', phone: '7075550123', insurance: 'UnitedHealthcare' },
  { id: 'pat_benjamin_foster', first: 'Benjamin', last: 'Foster', dob: '1964-04-14', phone: '7075550124', insurance: 'Delta Dental' },
  { id: 'pat_nadia_petrova', first: 'Nadia', last: 'Petrova', dob: '1996-12-11', phone: '7075550125', insurance: 'Guardian' },
  { id: 'pat_thomas_reed', first: 'Thomas', last: 'Reed', dob: '1958-07-27', phone: '7075550126', insurance: 'MetLife' },
];

// Past cleanings, so "book my six-month follow-up" is realistic:
// [patient, days ago (moved back to an open day if needed), preferred local hour].
const DEMO_HISTORY: [string, number, number][] = [
  ['pat_hannah_schmidt', 165, 10],
  ['pat_kenji_tanaka', 172, 9],
  ['pat_aisha_bello', 158, 14],
  ['pat_samuel_osei', 180, 15],
  ['pat_laura_bennett', 168, 11],
  ['pat_marco_rossi', 175, 16],
  // The O'Connors come in together: same day, back to back.
  ['pat_patrick_oconnor', 161, 9],
  ['pat_margaret_oconnor', 161, 10],
];

// Bookings thin out with distance, like a real practice.
const NEAR_TERM_OCCUPANCY = 0.85; // today and tomorrow
const TOP_UP_OCCUPANCY = 0.45;
const FAR_OCCUPANCY = 0.3; // beyond three months
const routineType = (role: ProviderRole): AppointmentType => (role === 'hygienist' ? 'cleaning' : 'checkup');

/** Occupancy by distance from today, as a lookup on epoch millis (hot loop: ~10k slots). */
function occupancyBands(today: DateTime, base: number): (startMs: number) => number {
  const nearEnd = today.plus({ days: 2 }).toMillis();
  const farStart = today.plus({ months: 3 }).toMillis();
  return (startMs) => (startMs < nearEnd ? NEAR_TERM_OCCUPANCY : startMs >= farStart ? FAR_OCCUPANCY : base);
}

/** Small deterministic PRNG (mulberry32). */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A number in [0, 1) derived from a string (FNV-1a, then one mulberry32 step). The top-up
 * draws per slot id rather than from a running stream, so whether a slot gets booked never
 * depends on which boot happened to add it.
 */
function hashRandom(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  return prng(h)();
}

interface SeedSlot {
  id: string;
  providerId: string;
  role: ProviderRole;
  /** Practice-local midnight of the slot's day (one shared object per day). */
  day: DateTime;
  /** Minutes after local midnight. */
  localMinutes: number;
  startMs: number;
  startIso: string;
  endIso: string;
  hold: boolean;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Every slot on the open days in [firstDay, firstDay + days), minus lunch, in a stable
 * order (day, provider, time). Ids derive from provider and local start, so the same slot
 * always gets the same id: that is what lets topUp() use INSERT OR IGNORE.
 *
 * Time zone math runs once per day: opening hours never span a DST change, so slot
 * times are plain millisecond offsets from the local opening time.
 */
function generateSlots(firstDay: DateTime, days: number): SeedSlot[] {
  const slots: SeedSlot[] = [];
  const openMinutes = PRACTICE.openHour * 60;
  const closeMinutes = PRACTICE.closeHour * 60;
  for (let d = 0; d < days; d++) {
    const day = firstDay.plus({ days: d });
    if (!isOpenDay(day)) continue;
    const dayKey = day.toFormat('yyyyMMdd');
    const openMs = day.set({ hour: PRACTICE.openHour }).toMillis();
    for (const provider of PROVIDERS) {
      const step = SLOT_MINUTES[provider.role];
      for (let m = openMinutes; m + step <= closeMinutes; m += step) {
        const hour = Math.floor(m / 60);
        if (hour >= PRACTICE.lunch.startHour && hour < PRACTICE.lunch.endHour) continue;
        const startMs = openMs + (m - openMinutes) * 60_000;
        slots.push({
          id: `slot_${provider.id.slice(5)}_${dayKey}_${pad2(hour)}${pad2(m % 60)}`,
          providerId: provider.id,
          role: provider.role,
          day,
          localMinutes: m,
          startMs,
          startIso: new Date(startMs).toISOString(),
          endIso: new Date(startMs + step * 60_000).toISOString(),
          // The first dentist slot each day is held for same-day emergencies.
          hold: provider.role === 'dentist' && m === openMinutes,
        });
      }
    }
  }
  return slots;
}

const isOpenDay = (day: DateTime): boolean => (PRACTICE.openWeekdays as readonly number[]).includes(day.weekday);

const SQL = {
  household: 'INSERT OR IGNORE INTO households (id, name) VALUES (?, ?)',
  patient: `INSERT OR IGNORE INTO patients (id, location_id, first_name, last_name, date_of_birth, phone,
       insurance_name, household_id, guardian_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  slot: 'INSERT OR IGNORE INTO slots (id, provider_id, start_at, end_at, emergency_hold) VALUES (?, ?, ?, ?, ?)',
  appointment: `INSERT OR IGNORE INTO appointments (id, patient_id, slot_id, type, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
};

const practiceToday = (now: DateTime): DateTime => now.setZone(PRACTICE.timezone).startOf('day');

export const isSeeded = (db: Db): boolean =>
  (db.prepare('SELECT COUNT(*) AS n FROM locations').get() as { n: number }).n > 0;

export function seed(db: Db, now: DateTime, options: Partial<SeedOptions> = {}): void {
  const opts = { ...DEFAULTS, ...options };
  const random = prng(opts.randomSeed);
  const createdAt = toUtcIso(now);
  const today = practiceToday(now);

  const insertPatient = db.prepare(SQL.patient);
  const insertSlot = db.prepare(SQL.slot);
  const insertAppointment = db.prepare(SQL.appointment);

  db.transaction(() => {
    db.prepare('INSERT INTO locations (id, name, address, phone, timezone) VALUES (?, ?, ?, ?, ?)').run(
      PRACTICE.locationId, PRACTICE.name, PRACTICE.address, PRACTICE.phone, PRACTICE.timezone,
    );
    for (const p of PROVIDERS) {
      db.prepare('INSERT INTO providers (id, location_id, name, role) VALUES (?, ?, ?, ?)').run(
        p.id, PRACTICE.locationId, p.name, p.role,
      );
    }

    db.prepare('INSERT INTO households (id, name) VALUES (?, ?)').run('hh_johnson', 'Johnson family');
    for (const p of NAMED_PATIENTS) {
      insertPatient.run(p.id, PRACTICE.locationId, p.first, p.last, p.dob, p.phone,
        p.insurance, p.household ?? null, p.guardian ?? null, createdAt);
    }
    const fillerIds = FILLER_FIRST.map((first, i) => {
      const id = `pat_filler_${i + 1}`;
      const dob = today.minus({ years: 22 + ((i * 7) % 50), days: i * 37 }).toISODate()!;
      insertPatient.run(id, PRACTICE.locationId, first, FILLER_LAST[i], dob,
        `41555501${String(50 + i).padStart(2, '0')}`, i % 4 === 0 ? null : 'Delta Dental', null, null, createdAt);
      return id;
    });

    // Capacity: every provider, every open day, minus lunch.
    const slots = generateSlots(today, opts.weeks * 7);
    for (const s of slots) insertSlot.run(s.id, s.providerId, s.startIso, s.endIso, s.hold ? 1 : 0);

    // Bookings: named patients first, then a fully booked Saturday, then random filler.
    // Slots are walked in date order, so a longer calendar never changes the earlier weeks.
    const taken = new Set<string>();
    let apptSeq = 0;
    const book = (patientId: string, slot: SeedSlot, type: AppointmentType) => {
      taken.add(slot.id);
      insertAppointment.run(`appt_seed_${++apptSeq}`, patientId, slot.id, type, 'booked', createdAt, createdAt);
    };
    const nowMs = now.toMillis();
    const future = slots.filter((s) => s.startMs > nowMs && !s.hold);

    for (const [patientId, type, daysOut, hour] of NAMED_APPOINTMENTS) {
      const role = APPOINTMENT_TYPES[type].providerRole;
      const targetMs = today.plus({ days: daysOut }).set({ hour }).toMillis();
      const slot = future.find((s) => s.role === role && s.startMs >= targetMs && !taken.has(s.id));
      if (slot) book(patientId, slot, type);
    }

    const weekOutMs = today.plus({ days: 7 }).toMillis();
    const busySaturday = future.find((s) => s.day.weekday === 6 && s.startMs >= weekOutMs);
    const filler = () => fillerIds[Math.floor(random() * fillerIds.length)];
    const occupancyAt = occupancyBands(today, opts.occupancy);

    for (const slot of future) {
      if (taken.has(slot.id)) continue;
      const fullDay = busySaturday && slot.day === busySaturday.day;
      if (random() < (fullDay ? 1 : occupancyAt(slot.startMs))) book(filler(), slot, routineType(slot.role));
    }
  })();
}

export interface TopUpResult {
  patients: number;
  slots: number;
  bookings: number;
  pastVisits: number;
}

/**
 * Brings any seeded database up to the current demo data without touching what is there:
 * the roster of demo patients, past cleanings for the follow-up demo, and slots from today
 * through SEED_WEEKS ahead. Only newly added slots get filler bookings, and the partial
 * unique index still guards every insert. Safe to run on every boot: once a day's calendar
 * exists, a second run adds nothing.
 */
export function topUp(db: Db, now: DateTime): TopUpResult {
  const today = practiceToday(now);
  const createdAt = toUtcIso(now);
  const result: TopUpResult = { patients: 0, slots: 0, bookings: 0, pastVisits: 0 };

  const insertSlot = db.prepare(SQL.slot);
  const insertAppointment = db.prepare(SQL.appointment);
  const appointmentExists = db.prepare('SELECT 1 FROM appointments WHERE id = ?');
  const slotInUse = db.prepare("SELECT 1 FROM appointments WHERE slot_id = ? AND status IN ('booked', 'completed')");

  db.transaction(() => {
    for (const [id, name] of DEMO_HOUSEHOLDS) db.prepare(SQL.household).run(id, name);
    const insertPatient = db.prepare(SQL.patient);
    for (const p of DEMO_PATIENTS) {
      result.patients += insertPatient.run(p.id, PRACTICE.locationId, p.first, p.last, p.dob, p.phone,
        p.insurance, p.household ?? null, p.guardian ?? null, createdAt).changes;
    }

    // Past cleanings. The appointment id is stable per patient, so a later boot (when
    // "165 days ago" is a different date) sees it exists and adds nothing.
    for (const [patientId, daysAgo, hour] of DEMO_HISTORY) {
      const id = `appt_hist_${patientId.slice(4)}`;
      if (appointmentExists.get(id)) continue;
      let day = today.minus({ days: daysAgo });
      while (!isOpenDay(day)) day = day.minus({ days: 1 });
      const slot = generateSlots(day, 1).find(
        (s) => s.role === 'hygienist' && s.localMinutes >= hour * 60 && !slotInUse.get(s.id),
      );
      if (!slot) continue;
      insertSlot.run(slot.id, slot.providerId, slot.startIso, slot.endIso, 0);
      result.pastVisits += insertAppointment.run(id, patientId, slot.id, 'cleaning', 'completed', createdAt, createdAt).changes;
    }

    // Capacity from today through SEED_WEEKS ahead. Existing slots are ignored by the
    // UNIQUE (provider_id, start_at) constraint; only slots this run created get filler.
    const fillerIds = (db.prepare("SELECT id FROM patients WHERE id LIKE 'pat_filler_%' ORDER BY id").all() as { id: string }[])
      .map((r) => r.id);
    const nowMs = now.toMillis();
    const occupancyAt = occupancyBands(today, TOP_UP_OCCUPANCY);
    for (const slot of generateSlots(today, SEED_WEEKS * 7)) {
      if (insertSlot.run(slot.id, slot.providerId, slot.startIso, slot.endIso, slot.hold ? 1 : 0).changes === 0) continue;
      result.slots++;
      if (slot.hold || slot.startMs <= nowMs || fillerIds.length === 0) continue;
      if (hashRandom(slot.id) >= occupancyAt(slot.startMs)) continue;
      const patientId = fillerIds[Math.floor(hashRandom(`${slot.id}:patient`) * fillerIds.length)];
      result.bookings += insertAppointment.run(`appt_fill_${slot.id.slice(5)}`, patientId, slot.id,
        routineType(slot.role), 'booked', createdAt, createdAt).changes;
    }
  })();

  return result;
}
