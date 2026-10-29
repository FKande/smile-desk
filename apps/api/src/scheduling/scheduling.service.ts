import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CLOCK, type Clock } from '../common/clock.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  SlotUnavailableError,
  ValidationError,
} from '../common/errors.js';
import {
  formatSlotLabel,
  PartOfDay,
  partOfDayOf,
  parsePracticeDateTime,
  toLocal,
  toUtcIso,
} from '../common/time.js';
import { DB, type Db, isUniqueViolation } from '../database/database.js';
import { PatientsService } from '../patients/patients.service.js';
import { APPOINTMENT_TYPES, AppointmentType, ProviderRole } from '../practice/practice.js';

export interface OpenSlot {
  slotId: string;
  start: string;
  end: string;
  label: string;
  providerName: string;
  providerRole: ProviderRole;
}

export interface AppointmentView {
  appointmentId: string;
  patientId: string;
  patientName: string;
  type: AppointmentType;
  typeLabel: string;
  status: 'booked' | 'cancelled' | 'completed';
  start: string;
  end: string;
  label: string;
  providerName: string;
  reason: string | null;
}

export interface SlotSearch {
  type: AppointmentType;
  /** ISO date or date-time, practice-local if no offset. Defaults to now. */
  from?: string;
  /** Exclusive. Defaults to two weeks after `from`. */
  to?: string;
  partOfDay?: PartOfDay;
  limit?: number;
  /** Spreads results across days instead of returning one packed morning. */
  maxPerDay?: number;
}

export interface BookingRequest {
  patientId: string;
  slotId: string;
  type: AppointmentType;
  /** Required for emergencies: what's wrong, in the patient's words. */
  reason?: string;
}

interface BookingOptions {
  /** The verified patient making the request, when booking for someone else. */
  bookedById?: string;
  /** Idempotency key: repeating a request returns the original booking. */
  requestId?: string;
}

interface SlotRow {
  id: string;
  provider_id: string;
  start_at: string;
  end_at: string;
  emergency_hold: number;
  provider_name: string;
  provider_role: ProviderRole;
}

interface AppointmentRow {
  id: string;
  patient_id: string;
  slot_id: string;
  type: AppointmentType;
  status: AppointmentView['status'];
  reason: string | null;
  start_at: string;
  end_at: string;
  provider_name: string;
  first_name: string;
  last_name: string;
}

const MIN_LEAD_MINUTES = 30;
const DEFAULT_WINDOW_DAYS = 14;
const MAX_WINDOW_DAYS = 90;
const MAX_GROUP_SIZE = 6;

const toOpenSlot = (r: SlotRow): OpenSlot => ({
  slotId: r.id,
  start: toLocal(r.start_at).toISO()!,
  end: toLocal(r.end_at).toISO()!,
  label: formatSlotLabel(r.start_at),
  providerName: r.provider_name,
  providerRole: r.provider_role,
});

const toView = (r: AppointmentRow): AppointmentView => ({
  appointmentId: r.id,
  patientId: r.patient_id,
  patientName: `${r.first_name} ${r.last_name}`,
  type: r.type,
  typeLabel: APPOINTMENT_TYPES[r.type].label,
  status: r.status,
  start: toLocal(r.start_at).toISO()!,
  end: toLocal(r.end_at).toISO()!,
  label: formatSlotLabel(r.start_at),
  providerName: r.provider_name,
  reason: r.reason,
});

const SLOT_SELECT = `
  SELECT s.id, s.provider_id, s.start_at, s.end_at, s.emergency_hold,
         p.name AS provider_name, p.role AS provider_role
  FROM slots s JOIN providers p ON p.id = s.provider_id`;

const APPOINTMENT_SELECT = `
  SELECT a.id, a.patient_id, a.slot_id, a.type, a.status, a.reason,
         s.start_at, s.end_at, pr.name AS provider_name, pt.first_name, pt.last_name
  FROM appointments a
  JOIN slots s ON s.id = a.slot_id
  JOIN providers pr ON pr.id = s.provider_id
  JOIN patients pt ON pt.id = a.patient_id`;

@Injectable()
export class SchedulingService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly patients: PatientsService,
  ) {}

  findOpenSlots(search: SlotSearch): OpenSlot[] {
    const type = this.assertType(search.type);
    const { fromIso, toIso } = this.resolveWindow(search.from, search.to);
    const limit = clamp(search.limit ?? 5, 1, 20);
    const maxPerDay = clamp(search.maxPerDay ?? 3, 1, 20);

    const rows = this.openSlotRows(APPOINTMENT_TYPES[type].providerRole, fromIso, toIso, type === 'emergency');
    const results: SlotRow[] = [];
    const perDay = new Map<string, number>();
    const seenStarts = new Set<string>();

    for (const row of rows) {
      const local = toLocal(row.start_at);
      if (search.partOfDay && partOfDayOf(local) !== search.partOfDay) continue;
      // Patients pick a time, not a chair: show each start time once.
      if (seenStarts.has(row.start_at)) continue;
      const day = local.toISODate()!;
      if ((perDay.get(day) ?? 0) >= maxPerDay) continue;
      seenStarts.add(row.start_at);
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
      results.push(row);
      if (results.length === limit) break;
    }
    return results.map(toOpenSlot);
  }

  /**
   * Finds chains of consecutive slots, one per family member, each starting when
   * the previous one ends. Returns at most one option per day for variety.
   */
  findBackToBack(search: {
    types: AppointmentType[];
    from?: string;
    to?: string;
    partOfDay?: PartOfDay;
    limit?: number;
  }): OpenSlot[][] {
    const types = search.types.map((t) => this.assertType(t));
    if (types.length < 2 || types.length > MAX_GROUP_SIZE) {
      throw new ValidationError(`Back-to-back booking needs 2 to ${MAX_GROUP_SIZE} appointments`);
    }
    if (types.includes('emergency')) {
      throw new ValidationError('Emergencies are booked individually, as soon as possible');
    }
    const { fromIso, toIso } = this.resolveWindow(search.from, search.to);
    const limit = clamp(search.limit ?? 3, 1, 10);

    const roles = types.map((t) => APPOINTMENT_TYPES[t].providerRole);
    const byRoleAndStart = new Map<string, SlotRow[]>();
    const rowsByRole = new Map<ProviderRole, SlotRow[]>();
    for (const role of new Set(roles)) {
      const rows = this.openSlotRows(role, fromIso, toIso, false);
      rowsByRole.set(role, rows);
      for (const row of rows) {
        const key = `${role}|${row.start_at}`;
        byRoleAndStart.set(key, [...(byRoleAndStart.get(key) ?? []), row]);
      }
    }

    const options: OpenSlot[][] = [];
    const daysUsed = new Set<string>();
    for (const first of rowsByRole.get(roles[0]) ?? []) {
      const local = toLocal(first.start_at);
      const day = local.toISODate()!;
      if (daysUsed.has(day)) continue;
      if (search.partOfDay && partOfDayOf(local) !== search.partOfDay) continue;

      const chain = [first];
      const used = new Set([first.id]);
      for (let i = 1; i < roles.length; i++) {
        const next = byRoleAndStart
          .get(`${roles[i]}|${chain[i - 1].end_at}`)
          ?.find((candidate) => !used.has(candidate.id));
        if (!next) break;
        chain.push(next);
        used.add(next.id);
      }
      if (chain.length !== roles.length) continue;

      options.push(chain.map(toOpenSlot));
      daysUsed.add(day);
      if (options.length === limit) break;
    }
    return options;
  }

  book(request: BookingRequest, options: BookingOptions = {}): AppointmentView {
    return this.bookMany([request], options)[0];
  }

  /** Books every request or none of them (family bookings must not half-succeed). */
  bookMany(requests: BookingRequest[], options: BookingOptions = {}): AppointmentView[] {
    if (requests.length === 0 || requests.length > MAX_GROUP_SIZE) {
      throw new ValidationError(`A booking needs 1 to ${MAX_GROUP_SIZE} appointments`);
    }
    const requestKey = (i: number) => (options.requestId ? `${options.requestId}#${i}` : null);

    if (options.requestId) {
      const previous = requests
        .map((_, i) => this.db.prepare(`${APPOINTMENT_SELECT} WHERE a.request_id = ?`).get(requestKey(i)) as AppointmentRow | undefined)
        .filter((r): r is AppointmentRow => !!r);
      if (previous.length > 0) return previous.map(toView);
    }

    const insert = this.db.prepare(
      `INSERT INTO appointments
         (id, patient_id, slot_id, type, status, reason, booked_by_id, request_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'booked', ?, ?, ?, ?, ?)`,
    );

    return this.db.transaction(() => {
      const ids: string[] = [];
      requests.forEach((request, i) => {
        const type = this.assertType(request.type);
        const patient = this.patients.getById(request.patientId);
        if (options.bookedById && !this.patients.canActFor(options.bookedById, patient.id)) {
          throw new ForbiddenError(`Not allowed to book for patient ${patient.id}`);
        }
        const reason = request.reason?.trim() || null;
        if (type === 'emergency' && !reason) {
          throw new ValidationError('Emergency bookings need a short summary of the problem');
        }
        const slot = this.getSlot(request.slotId);
        this.assertSlotFits(slot, type);
        this.assertNoOverlap(patient.id, `${patient.firstName} ${patient.lastName}`, slot);

        const id = `appt_${randomUUID()}`;
        const now = toUtcIso(this.clock.now());
        try {
          insert.run(id, patient.id, slot.id, type, reason, options.bookedById ?? null, requestKey(i), now, now);
        } catch (err) {
          if (isUniqueViolation(err)) throw new SlotUnavailableError(slot.id);
          throw err;
        }
        ids.push(id);
      });
      return ids.map((id) => this.getAppointment(id));
    })();
  }

  reschedule(input: { appointmentId: string; newSlotId: string; actorId: string }): AppointmentView {
    return this.db.transaction(() => {
      const current = this.getChangeableAppointment(input.appointmentId, input.actorId);
      if (current.slot_id === input.newSlotId) return toView(current);

      const slot = this.getSlot(input.newSlotId);
      this.assertSlotFits(slot, current.type);
      this.assertNoOverlap(current.patient_id, `${current.first_name} ${current.last_name}`, slot, current.id);
      try {
        this.db
          .prepare('UPDATE appointments SET slot_id = ?, updated_at = ? WHERE id = ?')
          .run(slot.id, toUtcIso(this.clock.now()), current.id);
      } catch (err) {
        if (isUniqueViolation(err)) throw new SlotUnavailableError(slot.id);
        throw err;
      }
      return this.getAppointment(current.id);
    })();
  }

  cancel(input: { appointmentId: string; actorId: string; reason?: string }): AppointmentView {
    return this.db.transaction(() => {
      const current = this.getChangeableAppointment(input.appointmentId, input.actorId);
      this.db
        .prepare("UPDATE appointments SET status = 'cancelled', cancel_reason = ?, updated_at = ? WHERE id = ?")
        .run(input.reason?.trim() || null, toUtcIso(this.clock.now()), current.id);
      return this.getAppointment(current.id);
    })();
  }

  /** Upcoming booked appointments for one or more patients (e.g. a whole household). */
  upcoming(patientIds: string[]): AppointmentView[] {
    if (patientIds.length === 0) return [];
    const placeholders = patientIds.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `${APPOINTMENT_SELECT}
         WHERE a.patient_id IN (${placeholders}) AND a.status = 'booked' AND s.start_at > ?
         ORDER BY s.start_at`,
      )
      .all(...patientIds, toUtcIso(this.clock.now())) as AppointmentRow[];
    return rows.map(toView);
  }

  getAppointment(id: string): AppointmentView {
    return toView(this.getAppointmentRow(id));
  }

  private getAppointmentRow(id: string): AppointmentRow {
    const row = this.db.prepare(`${APPOINTMENT_SELECT} WHERE a.id = ?`).get(id) as AppointmentRow | undefined;
    if (!row) throw new NotFoundError('Appointment', id);
    return row;
  }

  private getChangeableAppointment(appointmentId: string, actorId: string): AppointmentRow {
    const row = this.getAppointmentRow(appointmentId);
    if (!this.patients.canActFor(actorId, row.patient_id)) {
      throw new ForbiddenError(`Not allowed to change appointment ${appointmentId}`);
    }
    if (row.status !== 'booked') {
      throw new ConflictError(`Appointment ${appointmentId} is already ${row.status}`);
    }
    if (row.start_at <= toUtcIso(this.clock.now())) {
      throw new ConflictError(`Appointment ${appointmentId} has already started`);
    }
    return row;
  }

  private getSlot(id: string): SlotRow {
    const row = this.db.prepare(`${SLOT_SELECT} WHERE s.id = ?`).get(id) as SlotRow | undefined;
    if (!row) throw new NotFoundError('Slot', id);
    return row;
  }

  private assertSlotFits(slot: SlotRow, type: AppointmentType): void {
    const role = APPOINTMENT_TYPES[type].providerRole;
    if (slot.provider_role !== role) {
      throw new ValidationError(`A ${APPOINTMENT_TYPES[type].label.toLowerCase()} needs a ${role} slot`);
    }
    if (slot.start_at < this.earliestBookableIso()) {
      throw new ValidationError(`Slot ${slot.id} starts too soon or is in the past`);
    }
    if (slot.emergency_hold && type !== 'emergency') {
      throw new SlotUnavailableError(slot.id);
    }
  }

  /** Nobody can be booked into a chair that starts before they could get there. */
  private earliestBookableIso(): string {
    return toUtcIso(this.clock.now().plus({ minutes: MIN_LEAD_MINUTES }));
  }

  private assertNoOverlap(patientId: string, patientName: string, slot: SlotRow, excludeAppointmentId = ''): void {
    const clash = this.db
      .prepare(
        `SELECT s.start_at FROM appointments a JOIN slots s ON s.id = a.slot_id
         WHERE a.patient_id = ? AND a.status = 'booked' AND a.id != ?
           AND s.start_at < ? AND s.end_at > ?
         LIMIT 1`,
      )
      .get(patientId, excludeAppointmentId, slot.end_at, slot.start_at) as { start_at: string } | undefined;
    if (clash) {
      throw new ConflictError(`${patientName} already has an appointment on ${formatSlotLabel(clash.start_at)}`);
    }
  }

  private openSlotRows(role: ProviderRole, fromIso: string, toIso: string, includeHolds: boolean): SlotRow[] {
    return this.db
      .prepare(
        `${SLOT_SELECT}
         WHERE p.role = ? AND s.start_at >= ? AND s.start_at < ?
           AND (s.emergency_hold = 0 OR ? = 1)
           AND NOT EXISTS (
             SELECT 1 FROM appointments a WHERE a.slot_id = s.id AND a.status = 'booked'
           )
         ORDER BY s.start_at, p.name`,
      )
      .all(role, fromIso, toIso, includeHolds ? 1 : 0) as SlotRow[];
  }

  private resolveWindow(from?: string, to?: string): { fromIso: string; toIso: string } {
    const earliest = this.clock.now().plus({ minutes: MIN_LEAD_MINUTES });
    let start = from ? parsePracticeDateTime(from, 'from') : earliest;
    if (start < earliest) start = earliest;
    const end = to ? parsePracticeDateTime(to, 'to') : start.plus({ days: DEFAULT_WINDOW_DAYS });
    if (end <= start) throw new ValidationError('The search window ends before it starts');
    if (end.diff(start, 'days').days > MAX_WINDOW_DAYS) {
      throw new ValidationError(`Search at most ${MAX_WINDOW_DAYS} days at a time`);
    }
    return { fromIso: toUtcIso(start), toIso: toUtcIso(end) };
  }

  private assertType(type: string): AppointmentType {
    if (!(type in APPOINTMENT_TYPES)) {
      throw new ValidationError(`Unknown appointment type "${type}" (use cleaning, checkup or emergency)`);
    }
    return type as AppointmentType;
  }
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(n)));
