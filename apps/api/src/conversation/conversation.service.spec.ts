import { LlmRouterService } from '../llm/llm-router.service.js';
import { LlmSettingsService } from '../llm/llm-settings.service.js';
import type { LlmProvider, ProviderName, ToolCall, TranscriptItem, TurnRequest, TurnResult } from '../llm/llm.types.js';
import { createTestContext, type TestContext } from '../testing/test-context.js';
import { ConversationService } from './conversation.service.js';

// A scripted model: each step looks at the transcript (e.g. the last tool result)
// and returns either tool calls or a final reply, so the whole loop runs for real
// against the database without an API key.
type Step = (transcript: TranscriptItem[]) => { text?: string; calls?: Omit<ToolCall, 'id'>[]; failAfterStreaming?: boolean } | Error;

class ScriptedProvider implements LlmProvider {
  calls = 0;
  constructor(
    readonly name: ProviderName,
    private readonly steps: Step[],
    private readonly configured = true,
  ) {}
  isConfigured() {
    return this.configured;
  }
  async runTurn(request: TurnRequest): Promise<TurnResult> {
    const step = this.steps[Math.min(this.calls, this.steps.length - 1)];
    this.calls++;
    const out = step(request.transcript);
    if (out instanceof Error) throw out;
    // Stream the text word by word, the way a real provider delivers deltas.
    for (const word of (out.text ?? '').split(/(?<= )/)) if (word) request.onTextDelta?.(word);
    if (out.failAfterStreaming) throw new Error('connection dropped mid-stream');
    const toolCalls = (out.calls ?? []).map((c, i) => ({ ...c, id: `call_${this.calls}_${i}` }));
    return {
      provider: this.name,
      model: `${this.name}-test`,
      text: out.text ?? '',
      toolCalls,
      native: null,
      stopReason: toolCalls.length ? 'tool_use' : 'end',
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      warnings: [],
    };
  }
}

/** Parsed output of the most recent call to `tool` in the transcript. */
const lastResult = (transcript: TranscriptItem[], tool: string): Record<string, any> => {
  for (let i = transcript.length - 1; i >= 0; i--) {
    const item = transcript[i];
    if (item.kind !== 'tool_results') continue;
    const hit = item.results.find((r) => r.name === tool);
    if (hit) return JSON.parse(hit.output);
  }
  throw new Error(`no ${tool} result yet`);
};

function setup(primary: Step[], fallback?: Step[], opts: { primaryConfigured?: boolean } = {}) {
  const ctx: TestContext = createTestContext();
  const settings = new LlmSettingsService(ctx.db, ctx.clock);
  const anthropic = new ScriptedProvider('anthropic', primary, opts.primaryConfigured ?? true);
  const openai = new ScriptedProvider('openai', fallback ?? [() => new Error('openai down')]);
  const router = new LlmRouterService(settings, anthropic as never, openai as never);
  const service = new ConversationService(ctx.db, ctx.clock, router, settings, ctx.patients, ctx.scheduling, ctx.notifications);
  return { ctx, service, anthropic, openai, settings };
}

const SARAH = { first_name: 'Sarah', last_name: 'Johnson', date_of_birth: '1988-04-12', phone: null };

describe('ConversationService', () => {
  it('registers a new patient and books their first cleaning', async () => {
    const { service, ctx } = setup([
      () => ({ calls: [{ name: 'register_patient', input: { first_name: 'Jordan', last_name: 'Rivera', date_of_birth: '1990-08-15', phone: '415-555-0188', insurance_name: null } }] }),
      () => ({ calls: [{ name: 'find_open_slots', input: { appointment_type: 'cleaning', when: { period: 'next_week', portion: 'late', part_of_day: null }, limit: null } }] }),
      (t) => {
        const patientId = lastResult(t, 'register_patient').patient.patient_id;
        const slotId = lastResult(t, 'find_open_slots').options[0].slot_id;
        return { calls: [{ name: 'book_appointments', input: { bookings: [{ patient_id: patientId, slot_id: slotId, appointment_type: 'cleaning', reason: null }] } }] };
      },
      () => ({ text: "You're all set!" }),
    ]);

    const reply = await service.handleMessage({ message: "Hi, I'm new and need a cleaning later next week" });

    expect(reply.reply).toBe("You're all set!");
    expect(reply.appointments).toEqual([expect.objectContaining({ patientName: 'Jordan Rivera', typeLabel: 'Cleaning', status: 'booked' })]);
    const jordan = ctx.patients.verifyIdentity({ firstName: 'Jordan', lastName: 'Rivera', dateOfBirth: '1990-08-15' });
    expect(jordan).toMatchObject({ status: 'verified', patient: { insuranceName: null } });
  });

  it('refuses to book or reveal appointments before identity is verified', async () => {
    const { service, ctx } = setup([
      () => ({ calls: [{ name: 'get_my_appointments', input: {} }] }),
      (t) => ({ text: lastResult(t, 'get_my_appointments').error }),
    ]);
    const reply = await service.handleMessage({ message: "What's my next appointment?" });
    expect(reply.reply).toBe('forbidden');
    expect(ctx.scheduling.upcoming(['pat_sarah_johnson'])).toHaveLength(1); // untouched
  });

  it('remembers the verified patient across turns, server-side', async () => {
    const { service } = setup([
      () => ({ calls: [{ name: 'verify_patient', input: SARAH }] }),
      () => ({ text: 'Thanks Sarah, you are verified.' }),
      () => ({ calls: [{ name: 'get_my_appointments', input: {} }] }),
      (t) => ({ text: `You have ${lastResult(t, 'get_my_appointments').upcoming_appointments.length} upcoming` }),
    ]);
    const first = await service.handleMessage({ message: "I'm Sarah Johnson, born April 12 1988" });
    const second = await service.handleMessage({ conversationId: first.conversationId, message: 'What do we have coming up?' });
    expect(second.reply).toBe('You have 1 upcoming');
  });

  it('alerts staff automatically when an emergency is booked', async () => {
    const { service, ctx } = setup([
      () => ({ calls: [{ name: 'verify_patient', input: SARAH }] }),
      () => ({ calls: [{ name: 'find_open_slots', input: { appointment_type: 'emergency', when: { period: 'asap' }, limit: 1 } }] }),
      (t) => ({
        calls: [
          {
            name: 'book_appointments',
            input: { bookings: [{ patient_id: 'pat_sarah_johnson', slot_id: lastResult(t, 'find_open_slots').options[0].slot_id, appointment_type: 'emergency', reason: 'Cracked molar, throbbing pain since last night' }] },
          },
        ],
      }),
      (t) => ({ text: lastResult(t, 'book_appointments').staff_notified ? 'Booked, and I let the team know.' : 'Booked.' }),
    ]);

    const reply = await service.handleMessage({ message: 'I cracked a tooth and it really hurts' });

    expect(reply).toMatchObject({ reply: 'Booked, and I let the team know.', escalated: true });
    const alerts = ctx.notifications.list('open');
    expect(alerts).toEqual([expect.objectContaining({ kind: 'emergency', priority: 'urgent' })]);
    expect(alerts[0].summary).toContain('Cracked molar');
  });

  it('books a family back-to-back in one atomic call', async () => {
    const { service } = setup([
      () => ({ calls: [{ name: 'verify_patient', input: SARAH }] }),
      () => ({ calls: [{ name: 'find_back_to_back_slots', input: { appointment_types: ['cleaning', 'cleaning'], when: { period: 'next_week' } } }] }),
      (t) => {
        const [a, b] = lastResult(t, 'find_back_to_back_slots').options[0].slots;
        return {
          calls: [
            {
              name: 'book_appointments',
              input: {
                bookings: [
                  { patient_id: 'pat_emma_johnson', slot_id: a.slot_id, appointment_type: 'cleaning', reason: null },
                  { patient_id: 'pat_liam_johnson', slot_id: b.slot_id, appointment_type: 'cleaning', reason: null },
                ],
              },
            },
          ],
        };
      },
      () => ({ text: 'Both kids are booked back-to-back.' }),
    ]);
    const reply = await service.handleMessage({ message: 'Can I get my two kids in back-to-back next week?' });
    expect(reply.appointments.map((a) => a.patientName)).toEqual(['Emma Johnson', 'Liam Johnson']);
  });

  it('turns tool errors into results the model can recover from', async () => {
    const { service } = setup([
      () => ({ calls: [{ name: 'find_open_slots', input: { appointment_type: 'whitening', when: null, limit: null } }] }),
      (t) => ({ text: `error: ${lastResult(t, 'find_open_slots').error}` }),
    ]);
    expect((await service.handleMessage({ message: 'teeth whitening please' })).reply).toBe('error: invalid_input');
  });

  it('fails over to the other provider when the active one errors', async () => {
    const { service, anthropic, openai } = setup([() => new Error('anthropic 529 overloaded')], [() => ({ text: 'Hi from the fallback' })]);
    const reply = await service.handleMessage({ message: 'hello' });
    expect(reply).toMatchObject({ reply: 'Hi from the fallback', degraded: false });
    expect([anthropic.calls, openai.calls]).toEqual([1, 1]);
  });

  it('skips a provider with no API key', async () => {
    const { service, anthropic } = setup([() => ({ text: 'never' })], [() => ({ text: 'openai answered' })], { primaryConfigured: false });
    expect((await service.handleMessage({ message: 'hello' })).reply).toBe('openai answered');
    expect(anthropic.calls).toBe(0);
  });

  it('degrades safely and creates a callback when every provider is down', async () => {
    const { service, ctx } = setup([() => new Error('down')], [() => new Error('also down')]);
    const reply = await service.handleMessage({ message: 'I need to reschedule' });
    expect(reply).toMatchObject({ degraded: true, escalated: true });
    expect(reply.reply).toContain('(415) 555-0100');
    expect(ctx.notifications.list('open')).toEqual([expect.objectContaining({ kind: 'callback' })]);
  });

  it('stops a runaway tool loop and hands off to staff', async () => {
    const { service, ctx, settings } = setup([() => ({ calls: [{ name: 'get_practice_info', input: { topic: 'hours' } }] })]);
    settings.update({ harness: { maxToolIterations: 3 } });
    const reply = await service.handleMessage({ message: 'hours?' });
    expect(reply.escalated).toBe(true);
    expect(ctx.notifications.list('open')).toHaveLength(1);
  });

  it('stores an append-only transcript with the system context on each patient turn', async () => {
    const { service, ctx } = setup([() => ({ text: 'Hello!' })]);
    const { conversationId } = await service.handleMessage({ message: 'hi there' });
    const rows = ctx.db.prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY rowid').all(conversationId) as { role: string; content: string }[];
    expect(rows.map((r) => r.role)).toEqual(['user', 'assistant']);
    expect(JSON.parse(rows[0].content).context).toContain('Monday, November 2, 2026');
    expect(service.transcript(conversationId)).toEqual([
      { role: 'patient', text: 'hi there' },
      { role: 'assistant', text: 'Hello!' },
    ]);
  });

  describe('streaming events', () => {
    const record = () => {
      const events: string[] = [];
      return {
        events,
        handlers: {
          start: () => events.push('start'),
          delta: (t: string) => events.push(`delta:${t}`),
          reset: () => events.push('reset'),
          step: () => events.push('step'),
          tool: (name: string, label: string) => events.push(`tool:${name}:${label}`),
        },
      };
    };

    it('streams text, marks tool steps, and the reply equals what was streamed', async () => {
      const { service } = setup([
        () => ({ text: 'Let me check. ', calls: [{ name: 'get_practice_info', input: { topic: 'hours' } }] }),
        () => ({ text: 'We are open Mon to Sat.' }),
      ]);
      const { events, handlers } = record();
      const reply = await service.handleMessage({ message: 'hours?' }, handlers);

      expect(events).toEqual([
        'start',
        'delta:Let ',
        'delta:me ',
        'delta:check. ',
        'step',
        'tool:get_practice_info:Looking that up',
        'delta:We ',
        'delta:are ',
        'delta:open ',
        'delta:Mon ',
        'delta:to ',
        'delta:Sat.',
      ]);
      expect(reply.reply).toBe('Let me check.\n\nWe are open Mon to Sat.');
    });

    it('sends reset when a provider fails mid-stream, then the fallback streams cleanly', async () => {
      const { service } = setup([() => ({ text: 'Half a sen', failAfterStreaming: true })], [() => ({ text: 'Hello from OpenAI' })]);
      const { events, handlers } = record();
      const reply = await service.handleMessage({ message: 'hi' }, handlers);

      expect(events).toEqual(['start', 'delta:Half ', 'delta:a ', 'delta:sen', 'reset', 'delta:Hello ', 'delta:from ', 'delta:OpenAI']);
      expect(reply.reply).toBe('Hello from OpenAI');
    });

    it('rejects bad input before any event is sent', async () => {
      const { service } = setup([() => ({ text: 'never' })]);
      const { events, handlers } = record();
      await expect(service.handleMessage({ conversationId: 'conv_missing', message: 'hi' }, handlers)).rejects.toThrow('not found');
      await expect(service.handleMessage({ message: '   ' }, handlers)).rejects.toThrow('empty');
      expect(events).toEqual([]);
    });
  });

  it('records patient feedback against the conversation', async () => {
    const { service, ctx } = setup([() => ({ text: 'Hello!' })]);
    const { conversationId } = await service.handleMessage({ message: 'hi' });
    service.addFeedback(conversationId, -1, 'Too slow');
    expect(ctx.db.prepare('SELECT rating, comment FROM feedback').get()).toEqual({ rating: -1, comment: 'Too slow' });
  });
});
