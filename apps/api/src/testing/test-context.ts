import { DateTime } from 'luxon';
import { type Clock, fixedClock } from '../common/clock.js';
import { type Db, openDatabase } from '../database/database.js';
import { seed, topUp } from '../database/seed.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PatientsService } from '../patients/patients.service.js';
import { PRACTICE } from '../practice/practice.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';

/** Monday 9:00 AM practice time: a fixed "now" so every test sees the same calendar. */
export const TEST_NOW = DateTime.fromISO('2026-11-02T09:00', { zone: PRACTICE.timezone });

export interface TestContext {
  db: Db;
  clock: Clock;
  patients: PatientsService;
  scheduling: SchedulingService;
  notifications: NotificationsService;
}

export function createTestContext(now: DateTime = TEST_NOW): TestContext {
  const db = openDatabase(':memory:');
  seed(db, now);
  topUp(db, now); // as on every boot: the wider demo roster and past visits
  const clock = fixedClock(now);
  const patients = new PatientsService(db, clock);
  const scheduling = new SchedulingService(db, clock, patients);
  const notifications = new NotificationsService(db, clock);
  return { db, clock, patients, scheduling, notifications };
}
