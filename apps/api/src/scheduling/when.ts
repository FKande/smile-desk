import { DateTime } from 'luxon';
import type { PartOfDay } from '../common/time.js';
import { PRACTICE } from '../practice/practice.js';

// Turns what patients actually say ("later next week", "early next month",
// "next Tuesday afternoon") into a concrete search window. This is deliberately
// deterministic code, not the model: date arithmetic is where LLMs slip, and a
// wrong window means offering the wrong days with total confidence.

export interface ResolvedWindow {
  from: DateTime;
  /** Exclusive. */
  to: DateTime;
  partOfDay?: PartOfDay;
  /** Plain-English restatement so the bot can confirm what it understood. */
  description: string;
}

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, couple: 2, 'a couple': 2, 'a couple of': 2, 'couple of': 2,
  three: 3, few: 3, 'a few': 3, four: 4, five: 5, six: 6,
};

const PART_OF_DAY: [RegExp, PartOfDay][] = [
  [/\b(?:early |late )?(?:mornings?|am|before work|before lunch)\b/, 'morning'],
  [/\b(?:late afternoons?|evenings?|after work|after school|after 4(?: ?pm)?|end of (?:the )?day)\b/, 'evening'],
  [/\b(?:afternoons?|pm|after lunch|midday)\b/, 'afternoon'],
];

const FILLER = /\b(?:sometime|some time|maybe|preferably|ideally|probably|around|like|ish|please|if possible|works?|would be (?:best|great|good)|is (?:best|good|better))\b/g;

const DAY_LABEL = 'ccc, LLL d';

export function resolveWhen(input: string, now: DateTime): ResolvedWindow | null {
  const local = now.setZone(PRACTICE.timezone);
  const today = local.startOf('day');
  const thisWeek = today.startOf('week'); // ISO weeks start on Monday
  const nextWeek = thisWeek.plus({ weeks: 1 });

  let text = ` ${input.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ')} `.replace(/\s+/g, ' ');
  let partOfDay: PartOfDay | undefined;
  for (const [pattern, part] of PART_OF_DAY) {
    if (pattern.test(text)) {
      partOfDay ??= part;
      text = text.replace(pattern, ' ');
    }
  }
  text = text
    .replace(FILLER, ' ')
    .replace(/\b(?:in the|on|at|for|during)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const window = (from: DateTime, to: DateTime, description: string): ResolvedWindow | null => {
    const start = from < local ? local : from;
    if (to <= start) return null; // e.g. "early this week" said on a Friday
    return { from: start, to, partOfDay, description };
  };
  const day = (d: DateTime, prefix = '') => window(d, d.plus({ days: 1 }), `${prefix}${d.toFormat(DAY_LABEL)}`);

  if (!text || /^(?:any ?time|whenever|asap|as soon as possible|soonest|earliest|first available|next available|soon|any day)$/.test(text)) {
    return window(local, today.plus({ days: 14 }), 'the next two weeks');
  }
  if (/^today$/.test(text)) return day(today, 'today, ');
  if (/^(?:tomorrow|tmrw|tmr)$/.test(text)) return day(today.plus({ days: 1 }), 'tomorrow, ');
  if (/^(?:the )?day after tomorrow$/.test(text)) return day(today.plus({ days: 2 }));

  if (/^(?:iso )?\d{4} \d{2} \d{2}$/.test(text)) {
    const date = DateTime.fromISO(text.replace(/ /g, '-').replace(/^iso-/, ''), { zone: PRACTICE.timezone });
    return date.isValid ? day(date) : null;
  }

  // Weekends: the practice is open Saturdays only.
  let m = text.match(/^(this|next)? ?weekend$/);
  if (m) {
    let saturday = (m[1] === 'next' ? nextWeek : thisWeek).plus({ days: 5 });
    if (m[1] !== 'next' && today.weekday === 7) saturday = saturday.plus({ weeks: 1 });
    return day(saturday, 'Saturday (we are closed Sundays), ');
  }

  m = text.match(/^(?:the )?rest of (?:the |this )?week$/);
  if (m) return window(local, thisWeek.plus({ days: 7 }), 'the rest of this week');

  m = text.match(/^(?:the )?week after next$/);
  if (m) return weekPart(thisWeek.plus({ weeks: 2 }), undefined, 'the week after next');

  m = text.match(/^(?:(early|beginning of|start of|mid|middle of|late|later|end of)\s+)?(?:the\s+)?(this|next)?\s*week$/);
  if (m) {
    const base = m[2] === 'next' ? nextWeek : thisWeek;
    return weekPart(base, m[1], `${m[1] ? `${m[1]} ` : ''}${m[2] === 'next' ? 'next' : 'this'} week`);
  }

  m = text.match(/^(?:(early|beginning of|start of|mid|middle of|late|later|end of)\s+)?(?:the\s+)?(this|next)?\s*month$/);
  if (m) {
    const base = (m[2] === 'next' ? today.plus({ months: 1 }) : today).startOf('month');
    return monthPart(base, m[1], `${m[1] ? `${m[1]} ` : ''}${m[2] === 'next' ? 'next' : 'this'} month`);
  }

  m = text.match(new RegExp(`^(?:(early|beginning of|start of|mid|middle of|late|later|end of)\\s+)?(${MONTHS.join('|')})$`));
  if (m) {
    let base = today.set({ month: MONTHS.indexOf(m[2]) + 1 }).startOf('month');
    if (base.endOf('month') < local) base = base.plus({ years: 1 });
    return monthPart(base, m[1], `${m[1] ? `${m[1]} ` : ''}${base.toFormat('LLLL')}`);
  }

  m = text.match(new RegExp(`^(this|next|coming|this coming)? ?(${WEEKDAYS.join('|')})s?$`));
  if (m) {
    const index = WEEKDAYS.indexOf(m[2]) + 1;
    // "Tuesday" = the next Tuesday from today; "next Tuesday" = Tuesday of next week.
    let target = m[1] === 'next' ? nextWeek.plus({ days: index - 1 }) : thisWeek.plus({ days: index - 1 });
    if (m[1] !== 'next' && target < today) target = target.plus({ weeks: 1 });
    if (m[1] !== 'next' && target.hasSame(today, 'day') && local.hour >= PRACTICE.closeHour - 1) {
      target = target.plus({ weeks: 1 });
    }
    return day(target, index === 7 ? 'Sunday (we are closed Sundays), ' : '');
  }

  m = text.match(/^in (\d+|an?|one|two|three|four|five|six|a couple(?: of)?|couple(?: of)?|a few|few) (days?|weeks?|months?)$/);
  if (m) {
    const n = Number(m[1]) || NUMBER_WORDS[m[1]];
    if (m[2].startsWith('day')) return day(today.plus({ days: n }));
    if (m[2].startsWith('week')) {
      const weekStart = today.plus({ weeks: n }).startOf('week');
      return weekPart(weekStart, undefined, `the week of ${weekStart.toFormat('LLL d')}`);
    }
    const monthStart = today.plus({ months: n }).startOf('month');
    return monthPart(monthStart, undefined, monthStart.toFormat('LLLL'));
  }

  m = text.match(/^(?:the )?next (\d+|two|three|four|a couple(?: of)?|couple(?: of)?|a few|few) (days|weeks)$/);
  if (m) {
    const n = Number(m[1]) || NUMBER_WORDS[m[1]];
    const unit = m[2] === 'days' ? { days: n } : { weeks: n };
    return window(local, today.plus(unit).plus({ days: 1 }), `the next ${n} ${m[2]}`);
  }

  m = text.match(/^(?:after|from|starting) (?:the )?(\d{1,2})(?:st|nd|rd|th)?$/);
  if (m) {
    let start = today.set({ day: Number(m[1]) });
    if (!start.isValid || Number(m[1]) > today.daysInMonth!) return null;
    if (start < today) start = start.plus({ months: 1 });
    return window(start, start.plus({ days: 14 }), `the two weeks from ${start.toFormat('LLL d')}`);
  }

  return null;

  function weekPart(weekStart: DateTime, part: string | undefined, description: string) {
    const [fromDay, toDay] = !part
      ? [0, 7]
      : /early|beginning|start/.test(part) ? [0, 2] // Mon–Tue
      : /mid/.test(part) ? [1, 4] // Tue–Thu
      : [3, 6]; // later / end: Thu–Sat
    return window(weekStart.plus({ days: fromDay }), weekStart.plus({ days: toDay }), description);
  }

  function monthPart(monthStart: DateTime, part: string | undefined, description: string) {
    const nextMonth = monthStart.plus({ months: 1 });
    const [from, to] = !part
      ? [monthStart, nextMonth]
      : /early|beginning|start/.test(part) ? [monthStart, monthStart.set({ day: 11 })]
      : /mid/.test(part) ? [monthStart.set({ day: 11 }), monthStart.set({ day: 21 })]
      : [monthStart.set({ day: 21 }), nextMonth];
    return window(from, to, description);
  }
}
