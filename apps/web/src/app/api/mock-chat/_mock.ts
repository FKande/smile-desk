/* A scripted stand-in for the chat API, for exercising the UI without the
 * Nest server or a model key. Open the chat with ?mock=1 in `next dev`.
 * It speaks the same contract as the real API (see src/lib/chat-client.ts)
 * and picks a scripted turn from keywords in the message:
 *
 *   book / cleaning / checkup   → offers times (tool events, a step)
 *   a time, "first", "yes"      → books the offered time (appointment card)
 *   emergency / pain / swollen  → alerts staff, offers emergency times
 *   reschedule / move           → rescheduled card
 *   cancel                      → cancelled card
 *   insurance / pay / price     → payment options as bullets
 *   person / human / staff      → hand-off (escalated)
 *   mock:degraded  mock:error  mock:reset  mock:429  mock:400
 *
 * State lives on globalThis because each route file is bundled separately
 * in dev, and it resets when the dev server restarts (handy for testing the
 * "old conversation is gone" path). Never served outside development. */

import type { AppointmentSummary, ChatReply, TranscriptMessage } from "@/lib/chat-client";

type Pending = "cleaning" | "emergency" | null;

type MockConversation = {
  messages: TranscriptMessage[];
  pending: Pending;
  pendingReason: string;
  escalated: boolean;
  feedback: { rating: number; comment?: string }[];
};

const store = ((globalThis as { __smileDeskMock?: Map<string, MockConversation> }).__smileDeskMock ??= new Map());

export const mockEnabled = () => process.env.NODE_ENV === "development";

export const notFound = () => Response.json({ error: "not_found" }, { status: 404 });

export function getConversation(id: string) {
  return store.get(id);
}

/* ---------- Script ---------- */

type Frame = { event: string; data: unknown; delay?: number };

/** A scripted turn: SSE frames to stream, and the final reply they build. */
export type Turn = { frames: Frame[]; reply: ChatReply } | { status: number; body: unknown };

const PHONE = "(415) 555-0100";

/** "Tue, Nov 4 at 9:00 AM", `days` open days from today (skipping Sundays). */
function slot(days: number, time: string) {
  const date = new Date();
  for (let left = days; left > 0;) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0) left--;
  }
  const day = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return `${day} at ${time}`;
}

const card = (overrides: Partial<AppointmentSummary>): AppointmentSummary => ({
  action: "booked",
  appointmentId: `appt_mock_${crypto.randomUUID()}`,
  patientName: "Jordan Rivera",
  typeLabel: "Cleaning",
  label: slot(3, "9:00 AM"),
  providerName: "Dana Lee, RDH",
  status: "booked",
  ...overrides,
});

/** Splits text into word-sized deltas so the stream visibly builds up. */
function words(text: string): Frame[] {
  return (text.match(/\S+\s*|\s+/g) ?? []).map((piece) => ({ event: "delta", data: { text: piece }, delay: 35 }));
}

const tool = (name: string, label: string): Frame => ({ event: "tool", data: { name, label }, delay: 700 });
const step: Frame = { event: "step", data: {}, delay: 0 };

export function scriptTurn(conversationId: string, conversation: MockConversation, message: string): Turn {
  const text = message.toLowerCase();
  const frames: Frame[] = [];
  let reply = "";
  let appointments: AppointmentSummary[] = [];
  let degraded = false;

  const say = (part: string) => {
    frames.push(...words(part), step); // a model step ends; tools may follow
    reply = reply ? `${reply}\n\n${part}` : part;
  };

  if (text.includes("mock:429"))
    return { status: 429, body: { statusCode: 429, message: "ThrottlerException: Too Many Requests" } };
  if (text.includes("mock:400"))
    return { status: 400, body: { error: "invalid_input", message: "message is too long" } };

  if (text.includes("mock:error")) {
    frames.push(...words("Let me look into "), {
      event: "error",
      data: { error: "provider_error", message: "The assistant stopped unexpectedly." },
      delay: 300,
    });
    return { frames, reply: finalReply(conversationId, conversation, "", [], false) };
  }

  if (text.includes("mock:degraded")) {
    reply = `I'm sorry, I'm having trouble on my end right now. I've asked our team to reach out to you. If it's urgent, please call us at ${PHONE}.`;
    frames.push({ event: "delta", data: { text: reply }, delay: 600 });
    conversation.escalated = true;
    degraded = true;
  } else if (text.includes("mock:reset")) {
    frames.push(...words("Our first assistant started typing this, then"), { event: "reset", data: {}, delay: 400 });
    reply = "Sorry for the hiccup. The backup assistant picked this up: how can I help today?";
    frames.push(...words(reply));
  } else if (/emergenc|pain|hurt|swoll|broke|bleed|ache/.test(text)) {
    conversation.pending = "emergency";
    conversation.pendingReason = message;
    conversation.escalated = true;
    frames.push(tool("notify_staff", "Letting our team know"));
    say(
      "I'm sorry you're dealing with that. I've let our front desk know what's going on, and someone will call you shortly.",
    );
    frames.push(tool("find_open_slots", "Checking open times"));
    say(
      `These are the soonest emergency openings:\n• ${slot(0, "2:00 PM")} with Dr. Ana Ruiz\n• ${slot(0, "4:30 PM")} with Dr. Ana Ruiz\n\nWould either of those work? If you have severe swelling or trouble breathing, please call 911.`,
    );
  } else if (conversation.pending && /\d|\b(first|second|yes|works|that one|sure|ok|okay)\b/.test(text)) {
    const emergency = conversation.pending === "emergency";
    frames.push(tool("book_appointment", "Booking"));
    appointments = [
      emergency
        ? card({
            typeLabel: "Emergency visit",
            label: slot(0, "2:00 PM"),
            providerName: "Dr. Ana Ruiz",
            reason: conversation.pendingReason,
          })
        : card({}),
    ];
    say(
      emergency
        ? `You're booked for ${appointments[0].label} with Dr. Ana Ruiz. Please arrive 10 minutes early. Anything else I can help with?`
        : `All set: your cleaning is ${appointments[0].label} with Dana Lee. We'll text you a reminder the day before. Anything else?`,
    );
    conversation.pending = null;
  } else if (/book|clean|checkup|check-up|appointment|visit/.test(text)) {
    conversation.pending = "cleaning";
    say("Happy to help with that. Let me see what's open.");
    frames.push(tool("find_open_slots", "Checking open times"));
    say(
      `Here's what I have for a cleaning:\n• ${slot(3, "9:00 AM")} with Dana Lee\n• ${slot(3, "10:15 AM")} with Dana Lee\n• ${slot(4, "2:30 PM")} with Sam Ortiz\n\nDo any of those work, or is there a better day or time of day for you?`,
    );
  } else if (/reschedul|move|change/.test(text)) {
    frames.push(
      tool("find_appointments", "Checking your appointments"),
      tool("reschedule_appointment", "Rescheduling"),
    );
    appointments = [card({ action: "rescheduled", label: slot(5, "11:00 AM") })];
    say(`Done. I moved your cleaning to ${appointments[0].label}. Your old time is free for someone else.`);
  } else if (/cancel/.test(text)) {
    frames.push(tool("find_appointments", "Checking your appointments"), tool("cancel_appointment", "Cancelling"));
    appointments = [card({ action: "cancelled", status: "cancelled" })];
    say("Your cleaning is cancelled. Whenever you're ready to rebook, just let me know.");
  } else if (/insur|pay|price|cost|afford/.test(text)) {
    say(
      "We accept all major dental insurance plans, including Delta Dental, Aetna, Cigna and MetLife. No insurance is no problem either:\n" +
        "• Self-pay: a cleaning and exam is $150\n• Smile Club membership: $29 a month for adults, $19 for kids\n• Financing through CareCredit or Sunbit\n\nWould you like to book a visit?",
    );
  } else if (/person|human|staff|someone|call me/.test(text)) {
    conversation.escalated = true;
    frames.push(tool("notify_staff", "Letting our team know"));
    say(
      `Of course. I've asked a member of our front desk to reach out to you. You can also call us at ${PHONE}, Monday to Saturday, 8 AM to 6 PM.`,
    );
  } else {
    say(
      "I can help you book, move or cancel a visit, or answer questions about insurance and our hours. What would you like to do?",
    );
  }

  return { frames, reply: finalReply(conversationId, conversation, reply, appointments, degraded) };
}

function finalReply(
  conversationId: string,
  conversation: MockConversation,
  reply: string,
  appointments: AppointmentSummary[],
  degraded: boolean,
): ChatReply {
  return { conversationId, reply, appointments, escalated: conversation.escalated, degraded };
}

/* ---------- Request handling ---------- */

export type ParsedTurn = { conversationId: string; conversation: MockConversation; message: string } | Response;

/** Validates the body like the API does and finds (or opens) the conversation. */
export async function openTurn(request: Request): Promise<ParsedTurn> {
  const body = (await request.json().catch(() => null)) as { conversationId?: unknown; message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 2000) {
    return Response.json({ error: "invalid_input", message: "message must be 1-2000 characters" }, { status: 400 });
  }
  if (typeof body?.conversationId === "string") {
    const conversation = store.get(body.conversationId);
    if (!conversation) return notFound();
    return { conversationId: body.conversationId, conversation, message };
  }
  const conversationId = `conv_mock_${crypto.randomUUID()}`;
  const conversation: MockConversation = {
    messages: [],
    pending: null,
    pendingReason: "",
    escalated: false,
    feedback: [],
  };
  store.set(conversationId, conversation);
  return { conversationId, conversation, message };
}

/** Records the finished turn in the transcript. */
export function recordTurn(conversation: MockConversation, message: string, reply: string) {
  conversation.messages.push({ role: "patient", text: message });
  if (reply) conversation.messages.push({ role: "assistant", text: reply });
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });

/** Streams a scripted turn as SSE, pacing frames like a model would. */
export function streamTurn(
  conversationId: string,
  conversation: MockConversation,
  message: string,
  turn: Extract<Turn, { frames: Frame[] }>,
  signal: AbortSignal,
) {
  const encoder = new TextEncoder();
  const frame = (event: string, data: unknown) => encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(frame("start", { conversationId }));
      await wait(500, signal);
      for (const f of turn.frames) {
        if (signal.aborted) break;
        await wait(f.delay ?? 0, signal);
        controller.enqueue(frame(f.event, f.data));
        if (f.event === "error") {
          conversation.messages.push({ role: "patient", text: message });
          controller.close();
          return;
        }
      }
      if (!signal.aborted) {
        recordTurn(conversation, message, turn.reply.reply);
        controller.enqueue(frame("done", turn.reply));
      }
      controller.close();
    },
  });
}
