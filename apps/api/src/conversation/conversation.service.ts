import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CLOCK, type Clock } from '../common/clock.js';
import { NotFoundError, ValidationError } from '../common/errors.js';
import { toUtcIso } from '../common/time.js';
import { DB, type Db } from '../database/database.js';
import { LlmRouterService, LlmUnavailableError } from '../llm/llm-router.service.js';
import { LlmSettingsService } from '../llm/llm-settings.service.js';
import type { ToolResult, TranscriptItem } from '../llm/llm.types.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PatientsService } from '../patients/patients.service.js';
import { PRACTICE } from '../practice/practice.js';
import type { AppointmentView } from '../scheduling/scheduling.service.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { SYSTEM_PROMPT } from './system-prompt.js';
import { buildTools, type ToolBox, type ToolSession } from './tools.js';

export const MAX_MESSAGE_LENGTH = 2000;

export interface AppointmentCard {
  action: 'booked' | 'rescheduled' | 'cancelled';
  appointmentId: string;
  patientName: string;
  typeLabel: string;
  label: string;
  providerName: string;
  status: AppointmentView['status'];
}

export interface ChatReply {
  conversationId: string;
  reply: string;
  appointments: AppointmentCard[];
  /** Staff were alerted during this conversation (emergency or hand-off). */
  escalated: boolean;
  /** The model was unreachable and a safe fallback reply was sent instead. */
  degraded: boolean;
}

const REPLIES = {
  unavailable: `I'm sorry, I'm having trouble on my end right now. I've asked our team to reach out to you. If it's urgent, please call us at ${PRACTICE.phone}.`,
  refusal: `I'm not able to help with that here, but our front desk can. Please call us at ${PRACTICE.phone}, or tell me what you'd like to book.`,
  tooLong: `I'm sorry, this is taking me longer than it should. I've asked a team member to follow up with you directly.`,
  empty: `Sorry, I didn't quite catch that. Could you say it another way?`,
};

/** Progress callbacks for a streaming caller. All optional; the plain endpoint passes none. */
export interface ChatEvents {
  /** The conversation id, before any model work (new conversations get one here). */
  start?(conversationId: string): void;
  /** Reply text as the model writes it. */
  delta?(text: string): void;
  /** Text streamed since the last step is void (a provider failed mid-reply and another takes over). */
  reset?(): void;
  /** A model step ended in tool calls; later text continues the same reply. */
  step?(): void;
  /** A tool is about to run, with a label fit to show the patient. */
  tool?(name: string, label: string): void;
}

const TOOL_LABELS: Record<string, string> = {
  get_practice_info: 'Looking that up',
  verify_patient: 'Finding your record',
  register_patient: 'Setting up your patient file',
  add_family_member: 'Adding them to your family',
  get_my_appointments: 'Checking your appointments',
  find_open_slots: 'Checking open times',
  find_back_to_back_slots: 'Finding back-to-back times',
  book_appointments: 'Booking',
  reschedule_appointment: 'Rescheduling',
  cancel_appointment: 'Cancelling',
  notify_staff: 'Letting our team know',
};

const ROLE: Record<TranscriptItem['kind'], 'user' | 'assistant' | 'tool'> = {
  user: 'user',
  assistant: 'assistant',
  tool_results: 'tool',
};

@Injectable()
export class ConversationService {
  private readonly logger = new Logger('Conversation');
  private readonly tools: ToolBox;
  /** Serializes turns per conversation so two quick messages can't interleave tool calls. */
  private readonly locks = new Map<string, Promise<void>>();

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly router: LlmRouterService,
    private readonly settings: LlmSettingsService,
    private readonly patients: PatientsService,
    scheduling: SchedulingService,
    private readonly notifications: NotificationsService,
  ) {
    this.tools = buildTools({ patients, scheduling, notifications, clock });
  }

  /**
   * Validates the input before anything is sent, so a streaming caller can still
   * answer with a plain 400/404. Returns the normalized message.
   */
  validate(input: { conversationId?: string; message: string }): string {
    const message = input.message?.trim() ?? '';
    if (!message) throw new ValidationError('Message is empty');
    if (message.length > MAX_MESSAGE_LENGTH) throw new ValidationError(`Message is longer than ${MAX_MESSAGE_LENGTH} characters`);
    if (input.conversationId) this.getConversation(input.conversationId);
    return message;
  }

  async handleMessage(input: { conversationId?: string; message: string }, events: ChatEvents = {}): Promise<ChatReply> {
    const message = this.validate(input);
    const conversationId = input.conversationId ?? this.createConversation();
    events.start?.(conversationId);
    return this.withLock(conversationId, () => this.runTurn(conversationId, this.getConversation(conversationId), message, events));
  }

  addFeedback(conversationId: string, rating: 1 | -1, comment?: string): void {
    this.getConversation(conversationId);
    this.db
      .prepare('INSERT INTO feedback (id, conversation_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(`fb_${randomUUID()}`, conversationId, rating, comment?.trim().slice(0, 1000) || null, toUtcIso(this.clock.now()));
  }

  /** The visible chat (patient and assistant text only), for restoring a session in the UI. */
  transcript(conversationId: string): { role: 'patient' | 'assistant'; text: string }[] {
    this.getConversation(conversationId);
    return this.loadItems(conversationId, Number.MAX_SAFE_INTEGER).flatMap((item): { role: 'patient' | 'assistant'; text: string }[] =>
      item.kind === 'user'
        ? [{ role: 'patient' as const, text: item.text }]
        : item.kind === 'assistant' && item.text
          ? [{ role: 'assistant' as const, text: item.text }]
          : [],
    );
  }

  private async runTurn(conversationId: string, conversation: ConversationRow, message: string, events: ChatEvents): Promise<ChatReply> {
    const { maxToolIterations, historyLimit } = this.settings.get().harness;
    const session: ToolSession = {
      conversationId,
      actorId: conversation.patient_id,
      escalated: conversation.outcome === 'escalated',
      changedAppointments: [],
    };

    this.append(conversationId, { kind: 'user', text: message, context: this.contextBlock(session.actorId) });
    const transcript = this.loadItems(conversationId, historyLimit);
    // Text from every model step this turn, in order: the reply is what the patient watched stream.
    const texts: string[] = [];
    const replyWith = (ending?: string) => [...texts, ...(ending ? [ending] : [])].join('\n\n');
    let reply: string | null = null;
    let degraded = false;

    try {
      for (let i = 0; i < maxToolIterations && reply === null; i++) {
        const result = await this.router.runTurn({
          conversationId,
          system: SYSTEM_PROMPT,
          transcript,
          tools: this.tools.specs,
          onTextDelta: events.delta,
          onReset: events.reset,
        });
        if (result.text.trim()) texts.push(result.text.trim());
        const assistant: TranscriptItem = {
          kind: 'assistant',
          text: result.text,
          toolCalls: result.toolCalls,
          native: { provider: result.provider, model: result.model, data: result.native },
        };
        this.append(conversationId, assistant);
        transcript.push(assistant);

        if (result.stopReason === 'refusal') {
          reply = result.text ? replyWith() : replyWith(REPLIES.refusal);
        } else if (result.toolCalls.length === 0) {
          reply = texts.length ? replyWith() : REPLIES.empty;
        } else {
          events.step?.();
          const truncated = result.stopReason === 'max_tokens';
          const results: ToolResult[] = result.toolCalls.map((call) => {
            if (truncated) {
              return { callId: call.id, name: call.name, isError: true, output: JSON.stringify({ error: 'truncated', message: 'Your output was cut off; send a shorter tool call.' }) };
            }
            events.tool?.(call.name, TOOL_LABELS[call.name] ?? 'Working on it');
            const outcome = this.runTool(call.name, call.input, session);
            return { callId: call.id, name: call.name, ...outcome };
          });
          const toolItem: TranscriptItem = { kind: 'tool_results', results };
          this.append(conversationId, toolItem);
          transcript.push(toolItem);
        }
      }
      if (reply === null) {
        reply = replyWith(REPLIES.tooLong);
        this.handOff(session, `Conversation hit the ${maxToolIterations}-step limit without finishing; please follow up.`);
      }
    } catch (err) {
      if (!(err instanceof LlmUnavailableError)) throw err;
      this.logger.error(err.message);
      reply = replyWith(REPLIES.unavailable);
      degraded = true;
      this.handOff(session, `Assistant was unavailable mid-conversation (${err.attempts.map((a) => a.provider).join(', ')} failed). Last message: "${message.slice(0, 200)}"`);
      // Keep the transcript well-formed for the next turn.
      const fallback: TranscriptItem = { kind: 'assistant', text: REPLIES.unavailable, toolCalls: [] };
      this.append(conversationId, fallback);
    }

    this.db
      .prepare('UPDATE conversations SET patient_id = ?, last_message_at = ?, outcome = ? WHERE id = ?')
      .run(session.actorId, toUtcIso(this.clock.now()), session.escalated ? 'escalated' : conversation.outcome, conversationId);

    return {
      conversationId,
      reply,
      appointments: session.changedAppointments.map(({ action, appointment: a }) => ({
        action,
        appointmentId: a.appointmentId,
        patientName: a.patientName,
        typeLabel: a.typeLabel,
        label: a.label,
        providerName: a.providerName,
        status: a.status,
      })),
      escalated: session.escalated,
      degraded,
    };
  }

  private runTool(name: string, input: Record<string, unknown>, session: ToolSession): { output: string; isError: boolean } {
    try {
      const outcome = this.tools.execute(name, input, session);
      this.logger.log(`tool ${name} ${outcome.isError ? 'error' : 'ok'}${outcome.isError ? `: ${outcome.output.slice(0, 200)}` : ''}`);
      return outcome;
    } catch (err) {
      this.logger.error(`tool ${name} crashed: ${err instanceof Error ? err.stack : String(err)}`);
      return { output: JSON.stringify({ error: 'internal', message: 'Something went wrong on our side. Apologize and offer to have the team follow up.' }), isError: true };
    }
  }

  private handOff(session: ToolSession, summary: string): void {
    const patient = session.actorId ? this.patients.findById(session.actorId) : null;
    this.notifications.notifyStaff({
      kind: 'callback',
      priority: 'high',
      summary: patient ? `${patient.firstName} ${patient.lastName}: ${summary}` : summary,
      patientId: patient?.id ?? null,
      conversationId: session.conversationId,
    });
    session.escalated = true;
  }

  /** System-written facts for this turn; stored with the message so history stays append-only. */
  private contextBlock(actorId: string | null): string {
    const now = this.clock.now().setZone(PRACTICE.timezone);
    const actor = actorId ? this.patients.findById(actorId) : null;
    return [
      '<context>',
      `Now: ${now.toFormat("cccc, LLLL d, yyyy 'at' h:mm a")} (practice time).`,
      `Verified patient: ${actor ? `${actor.firstName} ${actor.lastName} (${actor.id})` : 'none yet'}.`,
      '</context>',
    ].join('\n');
  }

  private createConversation(): string {
    const id = `conv_${randomUUID()}`;
    const now = toUtcIso(this.clock.now());
    this.db
      .prepare('INSERT INTO conversations (id, location_id, started_at, last_message_at) VALUES (?, ?, ?, ?)')
      .run(id, PRACTICE.locationId, now, now);
    return id;
  }

  private getConversation(id: string): ConversationRow {
    const row = this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as ConversationRow | undefined;
    if (!row) throw new NotFoundError('Conversation', id);
    return row;
  }

  private append(conversationId: string, item: TranscriptItem): void {
    this.db
      .prepare('INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(`msg_${randomUUID()}`, conversationId, ROLE[item.kind], JSON.stringify(item), toUtcIso(this.clock.now()));
  }

  /** The most recent `limit` items, trimmed so the window starts at a patient message. */
  private loadItems(conversationId: string, limit: number): TranscriptItem[] {
    const rows = this.db
      .prepare('SELECT content FROM (SELECT rowid, content FROM messages WHERE conversation_id = ? ORDER BY rowid DESC LIMIT ?) ORDER BY rowid')
      .all(conversationId, limit) as { content: string }[];
    const items = rows.map((r) => JSON.parse(r.content) as TranscriptItem);
    const firstUser = items.findIndex((i) => i.kind === 'user');
    return firstUser <= 0 ? items : items.slice(firstUser);
  }

  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = previous.then(() => new Promise<void>((resolve) => (release = resolve)));
    this.locks.set(key, current);
    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.locks.get(key) === current) this.locks.delete(key);
    }
  }
}

interface ConversationRow {
  id: string;
  patient_id: string | null;
  outcome: string | null;
}
