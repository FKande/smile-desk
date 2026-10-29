import { DateTime } from 'luxon';
import { ValidationError } from '../common/errors.js';
import type { PartOfDay } from '../common/time.js';
import { PRACTICE } from '../practice/practice.js';

// Language and arithmetic are split on purpose. The model reads the patient's
// words ("uh, sometime later next week, after work?") and fills in this small,
// closed vocabulary; this module does the calendar math. The model is good at
// the first job and unreliable at the second, so it never computes a date.

export const PERIODS = ['asap', 'today', 'tomorrow', 'this_week', 'next_week', 'week_after_next', 'this_month', 'next_month'] as const;
export const PORTIONS = ['early', 'mid', 'late'] as const;
export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export const PARTS_OF_DAY = ['morning', 'afternoon', 'evening'] as const;

export type Period = (typeof PERIODS)[number];
export type Portion = (typeof PORTIONS)[number];
export type Weekday = (typeof WEEKDAYS)[number];

export interface WhenSpec {
  /** Relative period the patient named. */
  period?: Period;
  /** Narrows a week (Mon–Tue / Tue–Thu / Thu–Sat) or a month (1–10 / 11–20 / 21–end). */
  portion?: Portion;
  /** A specific day. With this_week/next_week it picks that week; alone it means the next one. */
  weekday?: Weekday;
  /** A named month (1–12), e.g. "early January". Combines with portion. */
  month?: number;
  /** "in 3 days" → that day; "in 2 weeks" → that whole week. */
  inDays?: number;
  inWeeks?: number;
  /** An exact date the patient gave, YYYY-MM-DD. */
  date?: string;
  /** An explicit range, YYYY-MM-DD. `to` is inclusive and defaults to two weeks after `from`. */
  from?: string;
  to?: string;
  partOfDay?: PartOfDay;
}

export interface ResolvedWindow {
  from: DateTime;
  /** Exclusive. */
  to: DateTime;
  partOfDay?: PartOfDay;
  /** Plain-English restatement so the bot can confirm what it understood. */
  description: string;
}

const DAY = 'ccc, LLL d';

export function resolveWhen(spec: WhenSpec, now: DateTime): ResolvedWindow {
  const local = now.setZone(PRACTICE.timezone);
  const today = local.startOf('day');
  const thisWeek = today.startOf('week'); // ISO weeks start Monday
  const anchors = [spec.date, spec.from, spec.period, spec.month, spec.inDays, spec.inWeeks].filter((v) => v !== undefined);
  if (anchors.length > 1) {
    throw new ValidationError('Use one of date, from/to, period, month, inDays or inWeeks, not several');
  }

  const result = (from: DateTime, to: DateTime, description: string): ResolvedWindow => {
    const start = from < local ? local : from;
    if (to <= start) {
      throw new ValidationError(`"${description}" is already over; ask the patient for another time`);
    }
    const shown = `${start.toFormat(DAY)}${to.minus({ days: 1 }).hasSame(start, 'day') ? '' : ` – ${to.minus({ days: 1 }).toFormat(DAY)}`}`;
    const part = spec.partOfDay ? `, ${spec.partOfDay}s` : '';
    return { from: start, to, partOfDay: spec.partOfDay, description: `${description} (${shown}${part})` };
  };
  const oneDay = (d: DateTime, label: string) => result(d, d.plus({ days: 1 }), label);

  if (spec.date) {
    const d = parseDate(spec.date, 'date');
    return oneDay(d, d.toFormat('cccc, LLLL d'));
  }

  if (spec.from) {
    const from = parseDate(spec.from, 'from');
    const to = spec.to ? parseDate(spec.to, 'to').plus({ days: 1 }) : from.plus({ days: 14 });
    return result(from, to, `from ${from.toFormat('LLL d')}`);
  }

  if (spec.month !== undefined) {
    if (!Number.isInteger(spec.month) || spec.month < 1 || spec.month > 12) {
      throw new ValidationError('month must be 1–12');
    }
    let start = today.set({ month: spec.month }).startOf('month');
    if (start.endOf('month') < local) start = start.plus({ years: 1 });
    return monthPortion(start, `${portionLabel(spec.portion)}${start.toFormat('LLLL')}`);
  }

  if (spec.inDays !== undefined) {
    const d = today.plus({ days: positive(spec.inDays, 'inDays') });
    return oneDay(d, `in ${spec.inDays} day${spec.inDays === 1 ? '' : 's'}`);
  }

  if (spec.inWeeks !== undefined) {
    const weekStart = today.plus({ weeks: positive(spec.inWeeks, 'inWeeks') }).startOf('week');
    return weekPortion(weekStart, `the week of ${weekStart.toFormat('LLL d')}`);
  }

  switch (spec.period) {
    case undefined:
    case 'asap':
      if (spec.weekday) return weekday(spec.weekday);
      return result(local, today.plus({ days: 14 }), 'the next two weeks');
    case 'today':
      return oneDay(today, 'today');
    case 'tomorrow':
      return oneDay(today.plus({ days: 1 }), 'tomorrow');
    case 'this_week':
    case 'next_week':
    case 'week_after_next': {
      const weekStart = thisWeek.plus({ weeks: { this_week: 0, next_week: 1, week_after_next: 2 }[spec.period] });
      const label = spec.period.replace(/_/g, ' ');
      if (spec.weekday) return oneDay(weekStart.plus({ days: WEEKDAYS.indexOf(spec.weekday) }), `${capitalize(spec.weekday)} ${label}`);
      return weekPortion(weekStart, `${portionLabel(spec.portion)}${label}`);
    }
    case 'this_month':
    case 'next_month': {
      const start = (spec.period === 'next_month' ? today.plus({ months: 1 }) : today).startOf('month');
      return monthPortion(start, `${portionLabel(spec.portion)}${spec.period.replace('_', ' ')}`);
    }
    default:
      throw new ValidationError(`Unknown period "${String(spec.period)}"`);
  }

  function weekday(day: Weekday): ResolvedWindow {
    let d = thisWeek.plus({ days: WEEKDAYS.indexOf(day) });
    // The coming one: today counts only while there is still time to book.
    if (d < today || (d.hasSame(today, 'day') && local.hour >= PRACTICE.closeHour - 1)) d = d.plus({ weeks: 1 });
    return oneDay(d, capitalize(day));
  }

  function weekPortion(weekStart: DateTime, label: string): ResolvedWindow {
    const [fromDay, toDay] = { early: [0, 2], mid: [1, 4], late: [3, 6] }[spec.portion ?? 'early'];
    return spec.portion
      ? result(weekStart.plus({ days: fromDay }), weekStart.plus({ days: toDay }), label)
      : result(weekStart, weekStart.plus({ days: 7 }), label);
  }

  function monthPortion(monthStart: DateTime, label: string): ResolvedWindow {
    const next = monthStart.plus({ months: 1 });
    if (!spec.portion) return result(monthStart, next, label);
    const ranges = { early: [monthStart, monthStart.set({ day: 11 })], mid: [monthStart.set({ day: 11 }), monthStart.set({ day: 21 })], late: [monthStart.set({ day: 21 }), next] };
    const [from, to] = ranges[spec.portion];
    return result(from, to, label);
  }
}

function parseDate(value: string, field: string): DateTime {
  const d = DateTime.fromISO(value, { zone: PRACTICE.timezone });
  if (!d.isValid) throw new ValidationError(`${field} must be YYYY-MM-DD, got "${value}"`);
  return d.startOf('day');
}

function positive(n: number, field: string): number {
  if (!Number.isInteger(n) || n < 0 || n > 26) throw new ValidationError(`${field} must be a whole number from 0 to 26`);
  return n;
}

const portionLabel = (p?: Portion) => (p === 'late' ? 'later ' : p ? `${p} ` : '');
const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);
