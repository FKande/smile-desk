// Static facts about the practice. In production these would be per-location
// rows managed by staff; for the prototype one location lives in code so the
// bot and the seed data share a single source of truth.

export type ProviderRole = 'dentist' | 'hygienist';

export const APPOINTMENT_TYPES = {
  cleaning: {
    label: 'Cleaning',
    durationMinutes: 60,
    providerRole: 'hygienist',
  },
  checkup: {
    label: 'General checkup',
    durationMinutes: 30,
    providerRole: 'dentist',
  },
  emergency: {
    label: 'Emergency visit',
    durationMinutes: 30,
    providerRole: 'dentist',
  },
} as const satisfies Record<
  string,
  { label: string; durationMinutes: number; providerRole: ProviderRole }
>;

export type AppointmentType = keyof typeof APPOINTMENT_TYPES;

export const PRACTICE = {
  locationId: 'loc_sf_market',
  name: 'Smile Desk Dental',
  address: '120 Market St, Suite 400, San Francisco, CA 94105',
  phone: '(415) 555-0100',
  timezone: 'America/Los_Angeles',
  hoursSummary: 'Monday to Saturday, 8:00 AM to 6:00 PM. Closed Sundays.',
  // Luxon weekdays: 1 = Monday ... 7 = Sunday.
  openWeekdays: [1, 2, 3, 4, 5, 6],
  openHour: 8,
  closeHour: 18,
  lunch: { startHour: 12, endHour: 13 },
} as const;

export const PAYMENT_OPTIONS = {
  insurance:
    'We accept all major dental insurance plans, including Delta Dental, Aetna, Cigna, MetLife, Guardian, UnitedHealthcare and Humana. We verify coverage before the visit.',
  selfPay: {
    summary:
      'No insurance is no problem. We offer transparent self-pay pricing, paid at the visit.',
    prices: {
      newPatientExamWithXrays: 199,
      cleaningAndExam: 150,
      emergencyExam: 95,
    },
  },
  membership: {
    name: 'Smile Club',
    adultMonthly: 29,
    childMonthly: 19,
    includes:
      'two cleanings and exams per year, routine X-rays, one emergency exam, and 20% off other treatment',
  },
  financing:
    'Financing through CareCredit or Sunbit, with 0% interest plans for 6 to 12 months on treatment over $200 (subject to approval).',
} as const;
