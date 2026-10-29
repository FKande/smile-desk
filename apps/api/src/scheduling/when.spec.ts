import { DateTime } from 'luxon';
import { ValidationError } from '../common/errors.js';
import { PRACTICE } from '../practice/practice.js';
import { resolveWhen, type WhenSpec } from './when.js';

// Monday Nov 2, 2026, 9:00 AM practice time.
const MONDAY = DateTime.fromISO('2026-11-02T09:00', { zone: PRACTICE.timezone });
const THURSDAY = MONDAY.plus({ days: 3 });

const range = (spec: WhenSpec, now = MONDAY) => {
  const w = resolveWhen(spec, now);
  return { from: w.from.toISODate(), to: w.to.minus({ milliseconds: 1 }).toISODate() };
};

describe('resolveWhen', () => {
  // Each row: what the patient said, what the model fills in, the dates we search.
  it.each<[string, WhenSpec, string, string]>([
    ['today', { period: 'today' }, '2026-11-02', '2026-11-02'],
    ['tomorrow', { period: 'tomorrow' }, '2026-11-03', '2026-11-03'],
    ['this week', { period: 'this_week' }, '2026-11-02', '2026-11-08'],
    ['next week', { period: 'next_week' }, '2026-11-09', '2026-11-15'],
    ['early next week', { period: 'next_week', portion: 'early' }, '2026-11-09', '2026-11-10'],
    ['middle of next week', { period: 'next_week', portion: 'mid' }, '2026-11-10', '2026-11-12'],
    ['later next week', { period: 'next_week', portion: 'late' }, '2026-11-12', '2026-11-14'],
    ['the week after next', { period: 'week_after_next' }, '2026-11-16', '2026-11-22'],
    ['next month', { period: 'next_month' }, '2026-12-01', '2026-12-31'],
    ['early next month', { period: 'next_month', portion: 'early' }, '2026-12-01', '2026-12-10'],
    ['mid next month', { period: 'next_month', portion: 'mid' }, '2026-12-11', '2026-12-20'],
    ['end of next month', { period: 'next_month', portion: 'late' }, '2026-12-21', '2026-12-31'],
    ['later this month', { period: 'this_month', portion: 'late' }, '2026-11-21', '2026-11-30'],
    ['early January', { month: 1, portion: 'early' }, '2027-01-01', '2027-01-10'],
    ['early May (six months ahead)', { month: 5, portion: 'early' }, '2027-05-01', '2027-05-10'],
    ['June (seven months ahead)', { month: 6 }, '2027-06-01', '2027-06-30'],
    ['my next cleaning in 6 months', { inMonths: 6 }, '2027-05-01', '2027-05-31'],
    ['early in 6 months', { inMonths: 6, portion: 'early' }, '2027-05-01', '2027-05-10'],
    ['late in 7 months', { inMonths: 7, portion: 'late' }, '2027-06-21', '2027-06-30'],
    ['in a month', { inMonths: 1 }, '2026-12-01', '2026-12-31'],
    ['in two weeks', { inWeeks: 2 }, '2026-11-16', '2026-11-22'],
    ['in 31 weeks', { inWeeks: 31 }, '2027-06-07', '2027-06-13'],
    ['in a couple of days', { inDays: 2 }, '2026-11-04', '2026-11-04'],
    ['Thursday', { weekday: 'thursday' }, '2026-11-05', '2026-11-05'],
    ['next Tuesday', { period: 'next_week', weekday: 'tuesday' }, '2026-11-10', '2026-11-10'],
    ['this Saturday', { period: 'this_week', weekday: 'saturday' }, '2026-11-07', '2026-11-07'],
    ['the 18th', { date: '2026-11-18' }, '2026-11-18', '2026-11-18'],
    ['anytime after the 20th', { from: '2026-11-20' }, '2026-11-20', '2026-12-03'],
    ['between the 10th and 12th', { from: '2026-11-10', to: '2026-11-12' }, '2026-11-10', '2026-11-12'],
    ['as soon as possible', { period: 'asap' }, '2026-11-02', '2026-11-15'],
    ['(no timing given)', {}, '2026-11-02', '2026-11-15'],
  ])('"%s" → %o → %s to %s', (_said, spec, from, to) => {
    expect(range(spec)).toEqual({ from, to });
  });

  it('passes the part of day through and says it back', () => {
    const w = resolveWhen({ period: 'next_week', portion: 'late', partOfDay: 'evening' }, MONDAY);
    expect(w.partOfDay).toBe('evening');
    expect(w.description).toBe('later next week (Thu, Nov 12 – Sat, Nov 14, evenings)');
  });

  it('never starts a window in the past', () => {
    expect(resolveWhen({ period: 'this_week' }, MONDAY).from.toMillis()).toBe(MONDAY.toMillis());
    expect(range({ period: 'this_week', portion: 'late' }, THURSDAY)).toEqual({ from: '2026-11-05', to: '2026-11-07' });
  });

  it('treats today as the coming weekday only while there is still time to book', () => {
    expect(range({ weekday: 'monday' })).toEqual({ from: '2026-11-02', to: '2026-11-02' });
    expect(range({ weekday: 'monday' }, MONDAY.set({ hour: 17, minute: 30 }))).toEqual({ from: '2026-11-09', to: '2026-11-09' });
  });

  it.each<[string, WhenSpec, DateTime]>([
    ['a window that is already over', { period: 'this_week', portion: 'early' }, THURSDAY],
    ['two anchors at once', { period: 'next_week', date: '2026-11-18' }, MONDAY],
    ['an invalid date', { date: '2026-02-31' }, MONDAY],
    ['an impossible month', { month: 13 }, MONDAY],
    ['a negative offset', { inWeeks: -1 }, MONDAY],
    ['more than 7 months out', { inMonths: 8 }, MONDAY],
    ['more than 31 weeks out', { inWeeks: 32 }, MONDAY],
    ['inMonths with a period', { inMonths: 6, period: 'next_month' }, MONDAY],
    ['inMonths with a named month', { inMonths: 6, month: 5 }, MONDAY],
  ])('rejects %s with a message the bot can act on', (_case, spec, now) => {
    expect(() => resolveWhen(spec, now)).toThrow(ValidationError);
  });
});
