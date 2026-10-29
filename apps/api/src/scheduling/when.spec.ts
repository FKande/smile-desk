import { DateTime } from 'luxon';
import { PRACTICE } from '../practice/practice.js';
import { resolveWhen } from './when.js';

// Monday Nov 2, 2026, 9:00 AM practice time.
const MONDAY = DateTime.fromISO('2026-11-02T09:00', { zone: PRACTICE.timezone });
const THURSDAY = MONDAY.plus({ days: 3 });

const range = (phrase: string, now = MONDAY) => {
  const w = resolveWhen(phrase, now);
  if (!w) return null;
  return { from: w.from.toISODate(), to: w.to.minus({ milliseconds: 1 }).toISODate(), partOfDay: w.partOfDay };
};

describe('resolveWhen', () => {
  it.each([
    ['today', '2026-11-02', '2026-11-02'],
    ['tomorrow', '2026-11-03', '2026-11-03'],
    ['this week', '2026-11-02', '2026-11-08'],
    ['next week', '2026-11-09', '2026-11-15'],
    ['early next week', '2026-11-09', '2026-11-10'],
    ['middle of next week', '2026-11-10', '2026-11-12'],
    ['later next week', '2026-11-12', '2026-11-14'],
    ['end of next week', '2026-11-12', '2026-11-14'],
    ['the week after next', '2026-11-16', '2026-11-22'],
    ['next month', '2026-12-01', '2026-12-31'],
    ['early next month', '2026-12-01', '2026-12-10'],
    ['mid next month', '2026-12-11', '2026-12-20'],
    ['late next month', '2026-12-21', '2026-12-31'],
    ['later this month', '2026-11-21', '2026-11-30'],
    ['early January', '2027-01-01', '2027-01-10'],
    ['in 2 weeks', '2026-11-16', '2026-11-22'],
    ['in a couple of days', '2026-11-04', '2026-11-04'],
    ['Thursday', '2026-11-05', '2026-11-05'],
    ['this Monday', '2026-11-02', '2026-11-02'],
    ['next Tuesday', '2026-11-10', '2026-11-10'],
    ['this weekend', '2026-11-07', '2026-11-07'],
    ['after the 20th', '2026-11-20', '2026-12-03'],
    ['2026-11-18', '2026-11-18', '2026-11-18'],
    ['asap', '2026-11-02', '2026-11-15'],
  ])('"%s" → %s to %s', (phrase, from, to) => {
    expect(range(phrase)).toMatchObject({ from, to });
  });

  it('pulls out the part of day and keeps the date meaning', () => {
    expect(range('next Tuesday afternoon')).toEqual({ from: '2026-11-10', to: '2026-11-10', partOfDay: 'afternoon' });
    expect(range('later next week, mornings preferably')).toMatchObject({ from: '2026-11-12', partOfDay: 'morning' });
    expect(range('sometime after work next week')).toMatchObject({ from: '2026-11-09', partOfDay: 'evening' });
    expect(range('mornings')).toMatchObject({ from: '2026-11-02', to: '2026-11-15', partOfDay: 'morning' });
  });

  it('never starts a window in the past', () => {
    const w = resolveWhen('this week', MONDAY)!;
    expect(w.from.toMillis()).toBe(MONDAY.toMillis());
    expect(range('later this week', THURSDAY)).toMatchObject({ from: '2026-11-05', to: '2026-11-07' });
  });

  it('returns null for windows that are already over, or phrases it cannot place', () => {
    expect(resolveWhen('early this week', THURSDAY)).toBeNull();
    expect(resolveWhen('when the moon is full', MONDAY)).toBeNull();
    expect(resolveWhen('after the 45th', MONDAY)).toBeNull();
  });

  it('describes the window so the bot can confirm it back', () => {
    expect(resolveWhen('later next week', MONDAY)!.description).toBe('later next week');
    expect(resolveWhen('this weekend', MONDAY)!.description).toContain('closed Sundays');
  });
});
