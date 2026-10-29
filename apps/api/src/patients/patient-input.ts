import { DateTime } from 'luxon';
import { ValidationError } from '../common/errors.js';
import { PRACTICE } from '../practice/practice.js';

// Input from a chat model is untrusted: normalize it, or fail with a message the
// bot can relay ("that phone number looks short, could you check it?").

const NAME_PATTERN = /^\p{L}[\p{L} .'-]{0,59}$/u;

export function normalizeName(value: string, field: string): string {
  const name = value?.trim().replace(/\s+/g, ' ');
  if (!name || !NAME_PATTERN.test(name)) {
    throw new ValidationError(`${field} "${value}" doesn't look like a name`);
  }
  return name;
}

/** US numbers only for now: returns 10 digits, accepting +1 and any formatting. */
export function normalizePhone(value: string): string {
  let digits = (value ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length !== 10) {
    throw new ValidationError(`Phone number "${value}" should have 10 digits`);
  }
  return digits;
}

export const formatPhone = (digits: string): string =>
  `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;

export function normalizeDateOfBirth(value: string, now: DateTime): string {
  const dob = DateTime.fromISO(value?.trim() ?? '', { zone: PRACTICE.timezone });
  if (!dob.isValid) {
    throw new ValidationError(`Date of birth "${value}" must be YYYY-MM-DD`);
  }
  if (dob > now) throw new ValidationError('Date of birth cannot be in the future');
  if (now.diff(dob, 'years').years > 120) {
    throw new ValidationError(`Date of birth "${value}" is more than 120 years ago`);
  }
  return dob.toISODate()!;
}

export const isMinor = (isoDob: string, now: DateTime): boolean =>
  now.diff(DateTime.fromISO(isoDob, { zone: PRACTICE.timezone }), 'years').years < 18;

const NO_INSURANCE = /^(none|no|n\/a|na|no insurance|uninsured|self[- ]?pay|cash|not insured)$/i;

/** Returns null for self-pay, whatever way the patient phrased it. */
export function normalizeInsurance(value: string | null | undefined): string | null {
  const name = value?.trim().replace(/\s+/g, ' ');
  if (!name || NO_INSURANCE.test(name)) return null;
  if (name.length > 80) throw new ValidationError('Insurance name is too long');
  return name;
}
