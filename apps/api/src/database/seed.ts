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

interface SeedOptions {
  weeks: number;
  occupancy: number;
  randomSeed: number;
}

const DEFAULTS: SeedOptions = { weeks: 6, occupancy: 0.5, randomSeed: 42 };

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

interface SeedSlot {
  id: string;
  providerId: string;
  role: ProviderRole;
  start: DateTime;
  startIso: string;
  hold: boolean;
}

export const isSeeded = (db: Db): boolean =>
  (db.prepare('SELECT COUNT(*) AS n FROM locations').get() as { n: number }).n > 0;

export function seed(db: Db, now: DateTime, options: Partial<SeedOptions> = {}): void {
  const opts = { ...DEFAULTS, ...options };
  const random = prng(opts.randomSeed);
  const createdAt = toUtcIso(now);
  const today = now.setZone(PRACTICE.timezone).startOf('day');

  const insertPatient = db.prepare(
    `INSERT INTO patients (id, location_id, first_name, last_name, date_of_birth, phone,
       insurance_name, household_id, guardian_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertSlot = db.prepare(
    'INSERT INTO slots (id, provider_id, start_at, end_at, emergency_hold) VALUES (?, ?, ?, ?, ?)',
  );
  const insertAppointment = db.prepare(
    `INSERT INTO appointments (id, patient_id, slot_id, type, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'booked', ?, ?)`,
  );

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
    const slots: SeedSlot[] = [];
    for (let d = 0; d < opts.weeks * 7; d++) {
      const day = today.plus({ days: d });
      if (!(PRACTICE.openWeekdays as readonly number[]).includes(day.weekday)) continue;
      for (const provider of PROVIDERS) {
        const step = SLOT_MINUTES[provider.role];
        let start = day.set({ hour: PRACTICE.openHour });
        const close = day.set({ hour: PRACTICE.closeHour });
        while (start.plus({ minutes: step }) <= close) {
          const inLunch = start.hour >= PRACTICE.lunch.startHour && start.hour < PRACTICE.lunch.endHour;
          if (!inLunch) {
            const hold = provider.role === 'dentist' && start.hour === PRACTICE.openHour && start.minute === 0;
            const slot: SeedSlot = {
              id: `slot_${provider.id.slice(5)}_${start.toFormat('yyyyMMdd_HHmm')}`,
              providerId: provider.id,
              role: provider.role,
              start,
              startIso: toUtcIso(start),
              hold,
            };
            insertSlot.run(slot.id, slot.providerId, slot.startIso, toUtcIso(start.plus({ minutes: step })), hold ? 1 : 0);
            slots.push(slot);
          }
          start = start.plus({ minutes: step });
        }
      }
    }

    // Bookings: named patients first, then a fully booked Saturday, then random filler.
    const taken = new Set<string>();
    let apptSeq = 0;
    const book = (patientId: string, slot: SeedSlot, type: AppointmentType) => {
      taken.add(slot.id);
      insertAppointment.run(`appt_seed_${++apptSeq}`, patientId, slot.id, type, createdAt, createdAt);
    };
    const future = slots.filter((s) => s.start > now && !s.hold);

    for (const [patientId, type, daysOut, hour] of NAMED_APPOINTMENTS) {
      const role = APPOINTMENT_TYPES[type].providerRole;
      const target = today.plus({ days: daysOut }).set({ hour });
      const slot = future.find((s) => s.role === role && s.start >= target && !taken.has(s.id));
      if (slot) book(patientId, slot, type);
    }

    const busySaturday = future.find((s) => s.start.weekday === 6 && s.start >= today.plus({ days: 7 }));
    const filler = () => fillerIds[Math.floor(random() * fillerIds.length)];
    const routineType = (role: ProviderRole): AppointmentType => (role === 'hygienist' ? 'cleaning' : 'checkup');

    for (const slot of future) {
      if (taken.has(slot.id)) continue;
      const fullDay = busySaturday && slot.start.hasSame(busySaturday.start, 'day');
      const nearTerm = slot.start < today.plus({ days: 2 });
      const occupancy = fullDay ? 1 : nearTerm ? 0.85 : opts.occupancy;
      if (random() < occupancy) book(filler(), slot, routineType(slot.role));
    }
  })();
}
