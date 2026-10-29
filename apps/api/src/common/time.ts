import { DateTime } from 'luxon';
import { PRACTICE } from '../practice/practice.js';
import { ValidationError } from './errors.js';

// Storage rule: every timestamp in the database is a UTC ISO string
// (e.g. 2026-11-02T16:00:00.000Z), so string comparison equals time order.

export const toUtcIso = (dt: DateTime): string => dt.toUTC().toISO()!;

export const toLocal = (utcIso: string): DateTime =>
  DateTime.fromISO(utcIso, { zone: 'utc' }).setZone(PRACTICE.timezone);

/** Human label in practice time, e.g. "Tue, Nov 3 at 10:00 AM". */
export const formatSlotLabel = (utcIso: string): string =>
  toLocal(utcIso).toFormat("ccc, LLL d 'at' h:mm a");

/** Parses a date or date-time; values without an offset are practice-local. */
export function parsePracticeDateTime(value: string, field: string): DateTime {
  const parsed = DateTime.fromISO(value, { zone: PRACTICE.timezone });
  if (!parsed.isValid) {
    throw new ValidationError(`${field} must be an ISO date or date-time, got "${value}"`);
  }
  return parsed;
}

export type PartOfDay = 'morning' | 'afternoon' | 'evening';

export const partOfDayOf = (local: DateTime): PartOfDay =>
  local.hour < 12 ? 'morning' : local.hour < 16 ? 'afternoon' : 'evening';
