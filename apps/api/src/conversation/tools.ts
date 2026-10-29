import { createHash } from 'node:crypto';
import { z } from 'zod';
import { DomainError, ForbiddenError } from '../common/errors.js';
import type { JsonSchemaObject, ToolSpec } from '../llm/llm.types.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { formatPhone } from '../patients/patient-input.js';
import { PatientsService, type Patient } from '../patients/patients.service.js';
import { APPOINTMENT_TYPES, PAYMENT_OPTIONS, PRACTICE } from '../practice/practice.js';
import { SchedulingService, type AppointmentView, type OpenSlot } from '../scheduling/scheduling.service.js';
import { PARTS_OF_DAY, PERIODS, PORTIONS, resolveWhen, WEEKDAYS, type WhenSpec } from '../scheduling/when.js';
import type { Clock } from '../common/clock.js';

/** Per-conversation state the tools read and write. Identity lives here, never in model output. */
export interface ToolSession {
  conversationId: string;
  /** The verified (or newly registered) patient this conversation acts for. */
  actorId: string | null;
  escalated: boolean;
  /** Appointments created, moved or cancelled during the current turn, for confirmation cards. */
  changedAppointments: { action: 'booked' | 'rescheduled' | 'cancelled'; appointment: AppointmentView }[];
}

export interface ToolDeps {
  patients: PatientsService;
  scheduling: SchedulingService;
  notifications: NotificationsService;
  clock: Clock;
}

interface Tool<T extends z.ZodType> {
  spec: ToolSpec;
  input: T;
  run(input: z.infer<T>, session: ToolSession): unknown;
}

// ── JSON Schema helpers ─────────────────────────────────────────────────────
// Optional fields are simply left out of `required` (plain JSON Schema, no null
// unions: Claude's strict mode caps how many union-typed fields a request may
// have). The OpenAI provider converts to its all-required + nullable form itself.
// Array length limits live in the Zod input schemas: strict mode rejects minItems > 1.
const OPTIONAL = Symbol('optional');
type Json = { [key: string]: unknown; [OPTIONAL]?: true };
const str = (description: string): Json => ({ type: 'string', description });
const enumOf = (values: readonly string[], description: string): Json => ({ type: 'string', enum: [...values], description });
const int = (description: string): Json => ({ type: 'integer', description });
const optional = (schema: Json): Json => ({ ...schema, [OPTIONAL]: true });
const object = (properties: Record<string, Json>): JsonSchemaObject => ({
  type: 'object',
  properties: Object.fromEntries(Object.entries(properties).map(([k, { [OPTIONAL]: _, ...schema }]) => [k, schema])),
  required: Object.keys(properties).filter((k) => !properties[k][OPTIONAL]),
  additionalProperties: false,
});

const APPOINTMENT_TYPE_IDS = Object.keys(APPOINTMENT_TYPES) as (keyof typeof APPOINTMENT_TYPES)[];
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD');
const nullish = <T extends z.ZodType>(schema: T) => schema.nullable().optional();

const WHEN_SCHEMA = object({
  phrase: optional(str("The patient's own words about timing, verbatim (e.g. \"later next week after work\").")),
  period: optional(enumOf(PERIODS, 'Relative period the patient named. asap = soonest available.')),
  portion: optional(enumOf(PORTIONS, 'Narrows period/month: early (Mon–Tue / 1st–10th), mid (Tue–Thu / 11th–20th), late (Thu–Sat / 21st–end).')),
  weekday: optional(enumOf(WEEKDAYS, 'A specific weekday. With this_week/next_week picks that week; alone means the coming one.')),
  month: optional(int('A named month 1–12 (e.g. "early January" → month 1, portion early).')),
  in_days: optional(int('"in N days" → N.')),
  in_weeks: optional(int('"in N weeks" → N (searches that whole week).')),
  date: optional(str('An exact date the patient gave, YYYY-MM-DD.')),
  from: optional(str('Start of an explicit range, YYYY-MM-DD.')),
  to: optional(str('End of an explicit range (inclusive), YYYY-MM-DD.')),
  part_of_day: optional(enumOf(PARTS_OF_DAY, 'morning (<12), afternoon (12–4), evening (4–6).')),
});

const whenInput = z
  .object({
    phrase: nullish(z.string().max(200)),
    period: nullish(z.enum(PERIODS)),
    portion: nullish(z.enum(PORTIONS)),
    weekday: nullish(z.enum(WEEKDAYS)),
    month: nullish(z.number().int()),
    in_days: nullish(z.number().int()),
    in_weeks: nullish(z.number().int()),
    date: nullish(isoDate),
    from: nullish(isoDate),
    to: nullish(isoDate),
    part_of_day: nullish(z.enum(PARTS_OF_DAY)),
  })
  .nullable()
  .optional();

const toWhenSpec = (w: z.infer<typeof whenInput>): WhenSpec => ({
  phrase: w?.phrase ?? undefined,
  period: w?.period ?? undefined,
  portion: w?.portion ?? undefined,
  weekday: w?.weekday ?? undefined,
  month: w?.month ?? undefined,
  inDays: w?.in_days ?? undefined,
  inWeeks: w?.in_weeks ?? undefined,
  date: w?.date ?? undefined,
  from: w?.from ?? undefined,
  to: w?.to ?? undefined,
  partOfDay: w?.part_of_day ?? undefined,
});

// ── Result shapes kept small: the model reads every token of them ──────────
const slotOut = (s: OpenSlot) => ({ slot_id: s.slotId, time: s.label, with: s.providerName });
const apptOut = (a: AppointmentView) => ({
  appointment_id: a.appointmentId,
  patient_id: a.patientId,
  patient: a.patientName,
  type: a.typeLabel,
  time: a.label,
  with: a.providerName,
  status: a.status,
});
const patientOut = (p: Patient) => ({
  patient_id: p.id,
  name: `${p.firstName} ${p.lastName}`,
  insurance: p.insuranceName ?? 'none (self-pay)',
});

function requireActor(session: ToolSession): string {
  if (!session.actorId) {
    throw new ForbiddenError('Identity not verified yet. Use verify_patient (existing patients) or register_patient (new patients) first.');
  }
  return session.actorId;
}

/** Keeps each tool's input type for its run() while storing tools in one list. */
const defineTool = <T extends z.ZodType>(tool: Tool<T>) => tool as unknown as Tool<z.ZodType>;

export function buildTools(deps: ToolDeps) {
  const { patients, scheduling, notifications, clock } = deps;

  const tools = [
    defineTool({
      spec: {
        name: 'get_practice_info',
        description: 'Facts about the practice: hours, location, contact, accepted insurance, self-pay prices, membership plan, financing, appointment types. Use instead of answering from memory.',
        inputSchema: object({
          topic: enumOf(['hours', 'location', 'contact', 'insurance', 'self_pay', 'membership', 'financing', 'appointment_types', 'all'], 'What the patient asked about.'),
        }),
      },
      input: z.object({ topic: z.enum(['hours', 'location', 'contact', 'insurance', 'self_pay', 'membership', 'financing', 'appointment_types', 'all']) }),
      run: ({ topic }) => {
        // Retrieval seam: one location's facts fit in code today; at scale this tool
        // reads per-location policy documents (RAG) behind the same interface.
        const facts: Record<string, unknown> = {
          hours: PRACTICE.hoursSummary,
          location: `${PRACTICE.name}, ${PRACTICE.address}`,
          contact: `Phone ${PRACTICE.phone}`,
          insurance: PAYMENT_OPTIONS.insurance,
          self_pay: { ...PAYMENT_OPTIONS.selfPay },
          membership: { ...PAYMENT_OPTIONS.membership },
          financing: PAYMENT_OPTIONS.financing,
          appointment_types: Object.values(APPOINTMENT_TYPES).map((t) => `${t.label}: ${t.durationMinutes} min with a ${t.providerRole}`),
        };
        return topic === 'all' ? facts : { [topic]: facts[topic] };
      },
    }),

    defineTool({
      spec: {
        name: 'verify_patient',
        description: 'Verify an existing patient before discussing or changing their appointments. Needs full name and date of birth; add phone if the result asks for it. On success this conversation acts for that patient and their family.',
        inputSchema: object({
          first_name: str('First name'),
          last_name: str('Last name'),
          date_of_birth: str('YYYY-MM-DD'),
          phone: optional(str('Phone number, any format')),
        }),
      },
      input: z.object({ first_name: z.string(), last_name: z.string(), date_of_birth: z.string(), phone: nullish(z.string()) }),
      run: (input, session) => {
        const result = patients.verifyIdentity({
          firstName: input.first_name,
          lastName: input.last_name,
          dateOfBirth: input.date_of_birth,
          phone: input.phone ?? undefined,
        });
        if (result.status === 'needs_phone') return { verified: false, next: 'Ask for the phone number on file and call again with it.' };
        if (result.status === 'not_found') {
          return { verified: false, next: "No match. Don't say whether a record exists. Ask them to double-check spelling and date of birth, or offer to register them as a new patient." };
        }
        session.actorId = result.patient.id;
        const family = patients.familyMembers(result.patient.id);
        return {
          verified: true,
          patient: patientOut(result.patient),
          family: family.map(patientOut),
          upcoming_appointments: scheduling.upcoming([result.patient.id, ...family.map((f) => f.id)]).map(apptOut),
        };
      },
    }),

    defineTool({
      spec: {
        name: 'register_patient',
        description: 'Register a new patient once you have all four: full name, phone, date of birth and insurance (null if uninsured). Confirm the details with the patient first.',
        inputSchema: object({
          first_name: str('First name'),
          last_name: str('Last name'),
          date_of_birth: str('YYYY-MM-DD'),
          phone: str('Phone number, any format'),
          insurance_name: optional(str('Insurance company, or null if none / self-pay')),
        }),
      },
      input: z.object({ first_name: z.string(), last_name: z.string(), date_of_birth: z.string(), phone: z.string(), insurance_name: nullish(z.string()) }),
      run: (input, session) => {
        const { patient, alreadyExisted } = patients.register({
          firstName: input.first_name,
          lastName: input.last_name,
          dateOfBirth: input.date_of_birth,
          phone: input.phone,
          insuranceName: input.insurance_name ?? null,
        });
        if (alreadyExisted) {
          const verified = patients.verifyIdentity({ firstName: input.first_name, lastName: input.last_name, dateOfBirth: input.date_of_birth, phone: input.phone });
          if (verified.status !== 'verified') {
            return { registered: false, next: 'This person may already be a patient with a different phone on file. Ask them to call the office to confirm their details.' };
          }
          session.actorId = patient.id;
          return { registered: false, already_a_patient: true, patient: patientOut(patient), upcoming_appointments: scheduling.upcoming([patient.id]).map(apptOut) };
        }
        session.actorId = patient.id;
        return { registered: true, patient: patientOut(patient) };
      },
    }),

    defineTool({
      spec: {
        name: 'add_family_member',
        description: "Add a spouse or child to the verified patient's family so they can be booked too. Children under 18 get the patient as guardian. Phone and insurance default to the patient's when null.",
        inputSchema: object({
          first_name: str('First name'),
          last_name: str('Last name'),
          date_of_birth: str('YYYY-MM-DD'),
          relationship: optional(str('e.g. son, daughter, spouse')),
          phone: optional(str("Their phone, or null to use the account holder's")),
          insurance_name: optional(str('Their insurance; null = same as account holder; "none" = self-pay')),
        }),
      },
      input: z.object({
        first_name: z.string(),
        last_name: z.string(),
        date_of_birth: z.string(),
        relationship: nullish(z.string()),
        phone: nullish(z.string()),
        insurance_name: nullish(z.string()),
      }),
      run: (input, session) => {
        const actorId = requireActor(session);
        const { patient, alreadyExisted } = patients.addFamilyMember(actorId, {
          firstName: input.first_name,
          lastName: input.last_name,
          dateOfBirth: input.date_of_birth,
          phone: input.phone ?? undefined,
          insuranceName: input.insurance_name ?? undefined,
        });
        if (alreadyExisted && !patients.canActFor(actorId, patient.id)) {
          throw new ForbiddenError('That person is registered under a different account; they or their guardian need to book.');
        }
        return { added: !alreadyExisted, family_member: patientOut(patient) };
      },
    }),

    defineTool({
      spec: {
        name: 'get_my_appointments',
        description: "Upcoming appointments for the verified patient and their family, with ids for rescheduling or cancelling.",
        inputSchema: object({}),
      },
      input: z.object({}),
      run: (_input, session) => {
        const actorId = requireActor(session);
        const family = patients.familyMembers(actorId);
        return {
          family: family.map(patientOut),
          upcoming_appointments: scheduling.upcoming([actorId, ...family.map((f) => f.id)]).map(apptOut),
        };
      },
    }),

    defineTool({
      spec: {
        name: 'find_open_slots',
        description:
          'Find open times for one appointment. Fill `when` from what the patient said: map their words onto the fields and never compute dates yourself. Leave fields null when not mentioned. If nothing fits, the result includes the nearest alternatives.',
        inputSchema: object({
          appointment_type: enumOf(APPOINTMENT_TYPE_IDS, 'cleaning, checkup, or emergency'),
          when: optional({ ...WHEN_SCHEMA, description: 'Timing the patient asked for; null if they gave none.' }),
          limit: optional(int('How many options (default 4)')),
        }),
      },
      input: z.object({ appointment_type: z.enum(APPOINTMENT_TYPE_IDS), when: whenInput, limit: nullish(z.number().int()) }),
      run: (input) => {
        const window = resolveWhen(toWhenSpec(input.when), clock.now());
        const limit = input.limit ?? 4;
        const slots = scheduling.findOpenSlots({
          type: input.appointment_type,
          from: window.from.toISO()!,
          to: window.to.toISO()!,
          partOfDay: window.partOfDay,
          limit,
          maxPerDay: 2,
        });
        if (slots.length) return { searched: window.description, options: slots.map(slotOut) };
        const alternatives = scheduling.findOpenSlots({
          type: input.appointment_type,
          from: window.to.toISO()!,
          to: window.to.plus({ days: 21 }).toISO()!,
          partOfDay: window.partOfDay,
          limit,
          maxPerDay: 1,
        });
        return {
          searched: window.description,
          options: [],
          note: 'Nothing open in that window.',
          nearest_alternatives: alternatives.map(slotOut),
        };
      },
    }),

    defineTool({
      spec: {
        name: 'find_back_to_back_slots',
        description: 'Find consecutive slots for several family members in one visit (each starts when the previous ends). One appointment type per person, in visit order.',
        inputSchema: object({
          appointment_types: { type: 'array', items: enumOf(['cleaning', 'checkup'], 'type for this person'), description: '2 to 6 people, in visit order' },
          when: optional({ ...WHEN_SCHEMA, description: 'Timing the patient asked for; null if they gave none.' }),
        }),
      },
      input: z.object({ appointment_types: z.array(z.enum(['cleaning', 'checkup'])).min(2).max(6), when: whenInput }),
      run: (input) => {
        const window = resolveWhen(toWhenSpec(input.when), clock.now());
        const options = scheduling.findBackToBack({
          types: input.appointment_types,
          from: window.from.toISO()!,
          to: window.to.toISO()!,
          partOfDay: window.partOfDay,
          limit: 3,
        });
        return {
          searched: window.description,
          options: options.map((chain) => ({ starts: chain[0].label, slots: chain.map(slotOut) })),
          ...(options.length ? {} : { note: 'No back-to-back block in that window. Offer a different window, or separate times.' }),
        };
      },
    }),

    defineTool({
      spec: {
        name: 'book_appointments',
        description:
          'Book one or more appointments after the patient confirms. Family bookings go in one call so they succeed or fail together. Emergencies need `reason` (what is wrong, in their words); staff are alerted automatically.',
        inputSchema: object({
          bookings: {
            type: 'array',
            description: '1 to 6 bookings',
            items: object({
              patient_id: str('From verify_patient / register_patient / add_family_member'),
              slot_id: str('From find_open_slots / find_back_to_back_slots'),
              appointment_type: enumOf(APPOINTMENT_TYPE_IDS, 'cleaning, checkup, or emergency'),
              reason: optional(str('Required for emergencies: short summary of the problem')),
            }),
          },
        }),
      },
      input: z.object({
        bookings: z
          .array(z.object({ patient_id: z.string(), slot_id: z.string(), appointment_type: z.enum(APPOINTMENT_TYPE_IDS), reason: nullish(z.string().max(500)) }))
          .min(1)
          .max(6),
      }),
      run: (input, session) => {
        const actorId = requireActor(session);
        const requestId = createHash('sha256').update(`${session.conversationId}|${JSON.stringify(input.bookings)}`).digest('hex').slice(0, 32);
        const booked = scheduling.bookMany(
          input.bookings.map((b) => ({ patientId: b.patient_id, slotId: b.slot_id, type: b.appointment_type, reason: b.reason ?? undefined })),
          { bookedById: actorId, requestId },
        );
        session.changedAppointments.push(...booked.map((appointment) => ({ action: 'booked' as const, appointment })));

        // Emergency alerts are enforced here, not left to the model's judgment.
        let staffNotified = false;
        for (const appt of booked.filter((a) => a.type === 'emergency')) {
          const patient = patients.getById(appt.patientId);
          notifications.notifyStaff({
            kind: 'emergency',
            priority: 'urgent',
            summary: `${appt.patientName} (${formatPhone(patient.phone)}): ${appt.reason}. Booked ${appt.label} with ${appt.providerName}.`,
            patientId: appt.patientId,
            conversationId: session.conversationId,
            details: { appointmentId: appt.appointmentId },
          });
          staffNotified = true;
          session.escalated = true;
        }
        return { booked: booked.map(apptOut), ...(staffNotified ? { staff_notified: true } : {}) };
      },
    }),

    defineTool({
      spec: {
        name: 'reschedule_appointment',
        description: 'Move an existing appointment to a new open slot of the same type, after the patient confirms.',
        inputSchema: object({ appointment_id: str('From get_my_appointments / verify_patient'), new_slot_id: str('From find_open_slots') }),
      },
      input: z.object({ appointment_id: z.string(), new_slot_id: z.string() }),
      run: (input, session) => {
        const appt = scheduling.reschedule({ appointmentId: input.appointment_id, newSlotId: input.new_slot_id, actorId: requireActor(session) });
        session.changedAppointments.push({ action: 'rescheduled', appointment: appt });
        return { rescheduled: apptOut(appt) };
      },
    }),

    defineTool({
      spec: {
        name: 'cancel_appointment',
        description: 'Cancel an appointment after the patient confirms. Offer to reschedule instead first.',
        inputSchema: object({ appointment_id: str('From get_my_appointments / verify_patient'), reason: optional(str('Why, if they said')) }),
      },
      input: z.object({ appointment_id: z.string(), reason: nullish(z.string().max(500)) }),
      run: (input, session) => {
        const appt = scheduling.cancel({ appointmentId: input.appointment_id, actorId: requireActor(session), reason: input.reason ?? undefined });
        session.changedAppointments.push({ action: 'cancelled', appointment: appt });
        return { cancelled: apptOut(appt) };
      },
    }),

    defineTool({
      spec: {
        name: 'notify_staff',
        description:
          'Alert the office team. Use for: emergencies not booked through book_appointments (e.g. advised to go to the ER, or no slot works); requests for a human; complaints or billing disputes; clinical questions; anything you cannot do. Tell the patient who will follow up.',
        inputSchema: object({
          kind: enumOf(['emergency', 'escalation', 'callback'], 'emergency = urgent dental problem; escalation = needs a human decision; callback = patient wants a call'),
          urgency: enumOf(['urgent', 'high', 'normal'], 'urgent = act now; high = today; normal = next business day'),
          summary: str('What happened and what the patient needs, in one or two sentences'),
          patient_name: optional(str('If not verified, the name they gave')),
          callback_phone: optional(str('Best number to reach them, if they gave one')),
        }),
      },
      input: z.object({
        kind: z.enum(['emergency', 'escalation', 'callback']),
        urgency: z.enum(['urgent', 'high', 'normal']),
        summary: z.string().min(5).max(1000),
        patient_name: nullish(z.string().max(120)),
        callback_phone: nullish(z.string().max(40)),
      }),
      run: (input, session) => {
        const who = session.actorId ? patients.findById(session.actorId) : null;
        const name = who ? `${who.firstName} ${who.lastName}` : (input.patient_name ?? 'Unverified patient');
        const phone = input.callback_phone ?? (who ? formatPhone(who.phone) : null);
        const notification = notifications.notifyStaff({
          kind: input.kind,
          priority: input.urgency,
          summary: `${name}${phone ? ` (${phone})` : ''}: ${input.summary}`,
          patientId: who?.id ?? null,
          conversationId: session.conversationId,
        });
        session.escalated = true;
        return { notified: true, reference: notification.id.slice(-6).toUpperCase() };
      },
    }),
  ];

  const byName = new Map(tools.map((t) => [t.spec.name, t]));

  return {
    specs: tools.map((t) => t.spec),
    /** Validates and runs one tool call. Never throws: failures become error results the model can act on. */
    execute(name: string, rawInput: unknown, session: ToolSession): { output: string; isError: boolean } {
      const tool = byName.get(name);
      if (!tool) return { output: JSON.stringify({ error: 'unknown_tool', message: `No tool named ${name}` }), isError: true };
      const parsed = tool.input.safeParse(rawInput);
      if (!parsed.success) {
        const message = parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ');
        return { output: JSON.stringify({ error: 'invalid_input', message }), isError: true };
      }
      try {
        return { output: JSON.stringify(tool.run(parsed.data, session)), isError: false };
      } catch (err) {
        if (err instanceof DomainError) {
          return { output: JSON.stringify({ error: err.code, message: err.message }), isError: true };
        }
        throw err;
      }
    },
  };
}

export type ToolBox = ReturnType<typeof buildTools>;
