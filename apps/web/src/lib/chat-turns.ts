import type { AppointmentSummary, ChatReply, TranscriptMessage } from "./chat-client";

/* What a finished turn shows under the assistant's reply (cards, emergency,
 * staff and degraded notices), worked out the same way for a live reply and
 * for history restored after a refresh. Only type imports, so node:test loads
 * it directly (test/chat-turns.test.mjs). */

export type TurnAttachments = {
  appointments: AppointmentSummary[];
  /** First reply after staff were alerted: show the hand-off notice. */
  staffNotified: boolean;
  emergency?: { summary: string; notifiedAt: string };
  degraded: boolean;
};

/** The flags a turn ended with: a live `done` reply, or a restored history entry. */
export type TurnOutcome = Partial<Pick<ChatReply, "appointments" | "escalated" | "degraded">>;

const EMERGENCY_TYPE = "Emergency visit";

/** What the patient told us about the emergency. The server's own summary
 *  (`reason`) wins; older servers don't send it, so fall back to the most
 *  descriptive recent patient message, since the latest one is often just
 *  "yes, 2 PM works". */
export function emergencySummary(card: AppointmentSummary, patientTexts: string[]): string {
  if (card.reason?.trim()) return card.reason.trim();
  const recent = patientTexts.slice(-4);
  return recent.reduce((best, text) => (text.length > best.length ? text : best), "") || "A dental emergency";
}

/**
 * `escalated` is sticky for the whole conversation, so the staff notice only
 * shows on the turn where it first became true (`alreadyEscalated` is false).
 * `patientTexts` are the patient's messages up to and including this turn.
 */
export function turnAttachments(
  outcome: TurnOutcome,
  { alreadyEscalated, patientTexts, notifiedAt }: { alreadyEscalated: boolean; patientTexts: string[]; notifiedAt: string },
): TurnAttachments {
  const appointments = outcome.appointments ?? [];
  const emergencyCard = appointments.find((a) => a.typeLabel === EMERGENCY_TYPE && a.action !== "cancelled");
  const newlyEscalated = Boolean(outcome.escalated) && !alreadyEscalated;
  return {
    appointments,
    // The emergency notice and the degraded alert already say the team was told.
    staffNotified: newlyEscalated && !emergencyCard && !outcome.degraded,
    emergency: emergencyCard ? { summary: emergencySummary(emergencyCard, patientTexts), notifiedAt } : undefined,
    degraded: Boolean(outcome.degraded),
  };
}

export type RestoredMessage =
  | { role: "patient"; text: string }
  | ({ role: "assistant"; text: string; at?: Date } & TurnAttachments);

/** Rebuilds the thread from GET /chat/:id/messages. `escalated` is where the
 *  conversation stands, so a later live turn doesn't announce staff again. */
export function restoreThread(
  history: TranscriptMessage[],
  timeOf: (date: Date) => string,
): { messages: RestoredMessage[]; escalated: boolean } {
  const patientTexts: string[] = [];
  let escalated = false;
  const messages = history.map((m): RestoredMessage => {
    if (m.role === "patient") {
      patientTexts.push(m.text);
      return { role: "patient", text: m.text };
    }
    const at = m.at ? new Date(m.at) : undefined;
    const valid = at && !Number.isNaN(at.getTime()) ? at : undefined;
    const attachments = turnAttachments(m, {
      alreadyEscalated: escalated,
      patientTexts,
      notifiedAt: valid ? timeOf(valid) : "",
    });
    escalated ||= Boolean(m.escalated);
    return { role: "assistant", text: m.text, at: valid, ...attachments };
  });
  return { messages, escalated };
}

/* ---------- Parsing ---------- */

const isString = (v: unknown): v is string => typeof v === "string";

function parseCard(value: unknown): AppointmentSummary | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Record<string, unknown>;
  const required = ["action", "appointmentId", "patientName", "typeLabel", "label", "providerName", "status"] as const;
  if (!required.every((key) => isString(c[key]))) return null;
  return {
    action: c.action as AppointmentSummary["action"],
    appointmentId: c.appointmentId as string,
    patientName: c.patientName as string,
    typeLabel: c.typeLabel as string,
    label: c.label as string,
    providerName: c.providerName as string,
    status: c.status as string,
    reason: isString(c.reason) ? c.reason : null,
    durationMinutes: typeof c.durationMinutes === "number" && c.durationMinutes > 0 ? c.durationMinutes : undefined,
  };
}

/** Validates a history payload. Older servers send text only; every newer
 *  field is optional and anything malformed is dropped, not fatal. */
export function parseTranscript(data: unknown): TranscriptMessage[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((m): TranscriptMessage[] => {
    if (!m || typeof m !== "object" || !isString(m.text)) return [];
    if (m.role === "patient") return [{ role: "patient", text: m.text }];
    if (m.role !== "assistant") return [];
    return [
      {
        role: "assistant",
        text: m.text,
        ...(Array.isArray(m.appointments)
          ? { appointments: m.appointments.map(parseCard).filter((c: AppointmentSummary | null) => c !== null) }
          : {}),
        ...(typeof m.escalated === "boolean" ? { escalated: m.escalated } : {}),
        ...(typeof m.degraded === "boolean" ? { degraded: m.degraded } : {}),
        ...(isString(m.at) ? { at: m.at } : {}),
      },
    ];
  });
}
