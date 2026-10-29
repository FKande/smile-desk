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

  async handleMessage(input: { conversationId?: string; message: string }): Promise<ChatReply> {
    const message = input.message?.trim() ?? '';
    if (!message) throw new ValidationError('Message is empty');
    if (message.length > MAX_MESSAGE_LENGTH) throw new ValidationError(`Message is longer than ${MAX_MESSAGE_LENGTH} characters`);

    const conversationId = input.conversationId ?? this.createConversation();
    const conversation = this.getConversation(conversationId);
    return this.withLock(conversationId, () => this.runTurn(conversationId, conversation, message));
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

  private async runTurn(conversationId: string, conversation: ConversationRow, message: string): Promise<ChatReply> {
    const { maxToolIterations, historyLimit } = this.settings.get().harness;
    const session: ToolSession = {
      conversationId,
      actorId: conversation.patient_id,
      escalated: conversation.outcome === 'escalated',
      changedAppointments: [],
    };

    this.append(conversationId, { kind: 'user', text: message, context: this.contextBlock(session.actorId) });
    const transcript = this.loadItems(conversationId, historyLimit);
    let reply: string | null = null;
    let degraded = false;

    try {
      for (let i = 0; i < maxToolIterations && reply === null; i++) {
        const result = await this.router.runTurn({ conversationId, system: SYSTEM_PROMPT, transcript, tools: this.tools.specs });
        const assistant: TranscriptItem = {
          kind: 'assistant',
          text: result.text,
          toolCalls: result.toolCalls,
          native: { provider: result.provider, model: result.model, data: result.native },
        };
        this.append(conversationId, assistant);
        transcript.push(assistant);

        if (result.stopReason === 'refusal') {
          reply = result.text || REPLIES.refusal;
        } else if (result.toolCalls.length === 0) {
          reply = result.text || REPLIES.empty;
        } else {
          const truncated = result.stopReason === 'max_tokens';
          const results: ToolResult[] = result.toolCalls.map((call) => {
            if (truncated) {
              return { callId: call.id, name: call.name, isError: true, output: JSON.stringify({ error: 'truncated', message: 'Your output was cut off; send a shorter tool call.' }) };
            }
            const outcome = this.runTool(call.name, call.input, session);
            return { callId: call.id, name: call.name, ...outcome };
          });
          const toolItem: TranscriptItem = { kind: 'tool_results', results };
          this.append(conversationId, toolItem);
          transcript.push(toolItem);
        }
      }
      if (reply === null) {
        reply = REPLIES.tooLong;
        this.handOff(session, `Conversation hit the ${maxToolIterations}-step limit without finishing; please follow up.`);
      }
    } catch (err) {
      if (!(err instanceof LlmUnavailableError)) throw err;
      this.logger.error(err.message);
      reply = REPLIES.unavailable;
      degraded = true;
      this.handOff(session, `Assistant was unavailable mid-conversation (${err.attempts.map((a) => a.provider).join(', ')} failed). Last message: "${message.slice(0, 200)}"`);
      // Keep the transcript well-formed for the next turn.
      const fallback: TranscriptItem = { kind: 'assistant', text: reply, toolCalls: [] };
      this.append(conversationId, fallback);
    }

    this.db
      .prepare('UPDATE conversations SET patient_id = ?, last_message_at = ?, outcome = ? WHERE id = ?')
      .run(session.actorId, toUtcIso(this.clock.now()), session.escalated ? 'escalated' : conversation.outcome, conversationId);

    return {
      conversationId,
      reply,
      appointments: session.changedAppointments.map((a) => ({
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
