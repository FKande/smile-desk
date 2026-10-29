import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CLOCK, type Clock } from '../common/clock.js';
import { NotFoundError } from '../common/errors.js';
import { toUtcIso } from '../common/time.js';
import { DB, type Db } from '../database/database.js';
import { PRACTICE } from '../practice/practice.js';

export type NotificationKind = 'emergency' | 'escalation' | 'callback';
export type NotificationPriority = 'urgent' | 'high' | 'normal';

export interface StaffNotification {
  id: string;
  kind: NotificationKind;
  priority: NotificationPriority;
  patientId: string | null;
  conversationId: string | null;
  summary: string;
  details: Record<string, unknown> | null;
  status: 'open' | 'acknowledged';
  createdAt: string;
}

interface NotificationRow {
  id: string;
  kind: NotificationKind;
  priority: NotificationPriority;
  patient_id: string | null;
  conversation_id: string | null;
  summary: string;
  details: string | null;
  status: 'open' | 'acknowledged';
  created_at: string;
}

const toNotification = (r: NotificationRow): StaffNotification => ({
  id: r.id,
  kind: r.kind,
  priority: r.priority,
  patientId: r.patient_id,
  conversationId: r.conversation_id,
  summary: r.summary,
  details: r.details ? (JSON.parse(r.details) as Record<string, unknown>) : null,
  status: r.status,
  createdAt: r.created_at,
});

// Staff alerts are durable rows first (nothing is lost if a channel is down), then
// fanned out. In production the fan-out is SMS/Slack/PMS; here it's the log + staff view.
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('StaffAlerts');

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  notifyStaff(input: {
    kind: NotificationKind;
    priority: NotificationPriority;
    summary: string;
    patientId?: string | null;
    conversationId?: string | null;
    details?: Record<string, unknown>;
  }): StaffNotification {
    const id = `ntf_${randomUUID()}`;
    this.db
      .prepare(
        `INSERT INTO staff_notifications
           (id, location_id, kind, priority, patient_id, conversation_id, summary, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, PRACTICE.locationId, input.kind, input.priority, input.patientId ?? null,
        input.conversationId ?? null, input.summary.trim(),
        input.details ? JSON.stringify(input.details) : null, toUtcIso(this.clock.now()));

    const line = `[${input.priority.toUpperCase()}] ${input.kind}: ${input.summary}`;
    if (input.priority === 'urgent') this.logger.warn(line);
    else this.logger.log(line);
    return this.get(id);
  }

  list(status?: 'open' | 'acknowledged'): StaffNotification[] {
    const rows = (
      status
        ? this.db.prepare('SELECT * FROM staff_notifications WHERE location_id = ? AND status = ? ORDER BY created_at DESC').all(PRACTICE.locationId, status)
        : this.db.prepare('SELECT * FROM staff_notifications WHERE location_id = ? ORDER BY created_at DESC').all(PRACTICE.locationId)
    ) as NotificationRow[];
    return rows.map(toNotification);
  }

  acknowledge(id: string): StaffNotification {
    const { changes } = this.db.prepare("UPDATE staff_notifications SET status = 'acknowledged' WHERE id = ?").run(id);
    if (changes === 0) throw new NotFoundError('Notification', id);
    return this.get(id);
  }

  private get(id: string): StaffNotification {
    const row = this.db.prepare('SELECT * FROM staff_notifications WHERE id = ?').get(id) as NotificationRow | undefined;
    if (!row) throw new NotFoundError('Notification', id);
    return toNotification(row);
  }
}
