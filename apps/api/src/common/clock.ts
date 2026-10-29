import { DateTime } from 'luxon';

// Injected wherever "now" matters so scheduling rules are testable at a fixed time.
export const CLOCK = Symbol('CLOCK');

export interface Clock {
  now(): DateTime;
}

export const systemClock: Clock = { now: () => DateTime.now() };

export const fixedClock = (at: DateTime): Clock => ({ now: () => at });
