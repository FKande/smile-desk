"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChatError,
  fetchTranscript,
  loadConversationId,
  saveConversationId,
  sendMessage,
  type AppointmentSummary,
  type ChatReply,
} from "@/lib/chat-client";
import { applyStreamEvent, emptyStream, streamedText } from "@/lib/reply-text";
import { PRACTICE_PHONE } from "./practice";

/* The patient chat's state: the thread, the reply in flight, the last error.
 * One turn at a time; sending while a reply streams is ignored, not queued. */

export type PatientMessage = { id: string; role: "patient"; text: string; at?: Date; failed?: boolean };

export type AssistantMessage = {
  id: string;
  role: "assistant";
  text: string;
  at?: Date;
  appointments: AppointmentSummary[];
  /** First reply after staff were alerted: show the hand-off notice. */
  staffNotified: boolean;
  emergency?: { summary: string; notifiedAt: string };
  degraded: boolean;
  /** Already shown as a streaming bubble, so it shouldn't animate in again. */
  streamed: boolean;
};

export type SystemMessage = { id: string; role: "system"; text: string };

export type ChatMessage = PatientMessage | AssistantMessage | SystemMessage;

/** The reply in flight: streamed text so far and the latest tool status. */
export type LiveReply = { text: string; status: string | null };

export type TurnError = { message: string; retryText: string; patientId: string };

const EMERGENCY_TYPE = "Emergency visit";

let counter = 0;
const newId = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`;

export const timeOf = (date: Date) => date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

function friendlyError(error: unknown): string {
  if (error instanceof ChatError) {
    switch (error.kind) {
      case "rate_limited":
        return "You're sending messages quickly, please wait a moment.";
      case "network":
        return "I couldn't reach the office just now. Check your connection and try again.";
      case "invalid_input":
        return "Sorry, I couldn't send that message. Try saying it a little differently.";
    }
  }
  return `Something went wrong on my side. Please try again, or call us at ${PRACTICE_PHONE}.`;
}

/** What the patient told us about the emergency. The server's own summary
 *  (`reason`) wins; otherwise the most descriptive recent patient message,
 *  since the latest one is often just "yes, 2 PM works". */
function emergencySummary(card: AppointmentSummary, thread: ChatMessage[]): string {
  if (card.reason?.trim()) return card.reason.trim();
  const recent = thread.filter((m): m is PatientMessage => m.role === "patient").slice(-4);
  return recent.reduce((best, m) => (m.text.length > best.length ? m.text : best), "") || "A dental emergency";
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [live, setLive] = useState<LiveReply | null>(null);
  const [error, setError] = useState<TurnError | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const idRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const restoreRef = useRef<AbortController | null>(null);
  // `escalated` is sticky for the whole conversation; notify the patient once.
  const escalatedRef = useRef(false);

  const remember = useCallback((id: string | null) => {
    idRef.current = id;
    setConversationId(id);
    saveConversationId(id);
  }, []);

  // Restore an earlier conversation from this browser.
  useEffect(() => {
    const id = loadConversationId();
    if (!id) return;
    const controller = new AbortController();
    restoreRef.current = controller;
    idRef.current = id;
    busyRef.current = true;
    // localStorage only exists after hydration, so this can't be initial state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRestoring(true);
    fetchTranscript(id, controller.signal)
      .then((history) => {
        setConversationId(id);
        setMessages(
          history.map((m): ChatMessage =>
            m.role === "patient"
              ? { id: newId(), role: "patient", text: m.text }
              : {
                  id: newId(),
                  role: "assistant",
                  text: m.text,
                  appointments: [],
                  staffNotified: false,
                  degraded: false,
                  streamed: true,
                },
          ),
        );
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        // Gone (expired, or the server was reset): start fresh, quietly.
        if (err instanceof ChatError && err.kind === "not_found") remember(null);
        else setConversationId(id); // unreachable for now; the next send tries again
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        busyRef.current = false;
        setRestoring(false);
      });
    return () => {
      controller.abort();
      busyRef.current = false;
    };
  }, [remember]);

  const send = useCallback(
    async (input: string, retryOf?: string) => {
      const text = input.trim();
      if (!text || busyRef.current) return;
      busyRef.current = true;

      const patientId = retryOf ?? newId();
      setError(null);
      setMessages((list) =>
        retryOf
          ? list.map((m) => (m.id === retryOf ? { ...m, failed: false } : m))
          : [...list, { id: patientId, role: "patient", text, at: new Date() }],
      );
      setLive({ text: "", status: null });

      const controller = new AbortController();
      abortRef.current = controller;
      let stream = emptyStream;

      const turn = (id: string | null) => {
        stream = emptyStream;
        return sendMessage({
          conversationId: id ?? undefined,
          message: text,
          signal: controller.signal,
          onEvent(event) {
            if (controller.signal.aborted) return;
            if (event.type === "start") {
              if (event.conversationId) remember(event.conversationId);
            } else if (event.type === "tool") {
              setLive((prev) => ({ text: prev?.text ?? "", status: event.label || "Working on it" }));
            } else {
              stream = applyStreamEvent(stream, event);
              const next = streamedText(stream);
              // New text means the tool step is over; step/reset keep the status.
              setLive((prev) => ({ text: next, status: event.type === "delta" ? null : (prev?.status ?? null) }));
            }
          },
        });
      };

      try {
        let reply: ChatReply;
        try {
          reply = await turn(idRef.current);
        } catch (err) {
          // The stored conversation no longer exists: open a new one and resend.
          if (!(err instanceof ChatError && err.kind === "not_found" && idRef.current)) throw err;
          remember(null);
          setLive({ text: "", status: null });
          setMessages((list) => {
            const at = list.findIndex((m) => m.id === patientId);
            const notice: SystemMessage = {
              id: newId(),
              role: "system",
              text: "Your earlier conversation has ended, so we've started a new one.",
            };
            return at === -1 ? [...list, notice] : [...list.slice(0, at), notice, ...list.slice(at)];
          });
          reply = await turn(null);
        }
        if (controller.signal.aborted) return;

        remember(reply.conversationId);
        const streamed = streamedText(stream).length > 0;
        const at = new Date();
        const emergencyCard = reply.appointments?.find(
          (a) => a.typeLabel === EMERGENCY_TYPE && a.action !== "cancelled",
        );
        const newlyEscalated = Boolean(reply.escalated) && !escalatedRef.current;
        escalatedRef.current ||= Boolean(reply.escalated);

        setMessages((list) => [
          ...list,
          {
            id: newId(),
            role: "assistant",
            text: reply.reply,
            at,
            appointments: reply.appointments ?? [],
            // The emergency notice already says the team was told.
            staffNotified: newlyEscalated && !emergencyCard,
            emergency: emergencyCard
              ? { summary: emergencySummary(emergencyCard, list), notifiedAt: timeOf(at) }
              : undefined,
            degraded: Boolean(reply.degraded),
            streamed,
          },
        ]);
      } catch (err) {
        if (controller.signal.aborted) return;
        setMessages((list) => list.map((m) => (m.id === patientId ? { ...m, failed: true } : m)));
        setError({ message: friendlyError(err), retryText: text, patientId });
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          busyRef.current = false;
          setLive(null);
        }
      }
    },
    [remember],
  );

  const retry = useCallback(() => {
    if (error) void send(error.retryText, error.patientId);
  }, [error, send]);

  /** Drops the thread (and any reply in flight) and forgets the stored id. */
  const reset = useCallback(() => {
    restoreRef.current?.abort();
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    escalatedRef.current = false;
    remember(null);
    setMessages([]);
    setLive(null);
    setError(null);
    setRestoring(false);
  }, [remember]);

  return { messages, live, error, restoring, conversationId, busy: live !== null || restoring, send, retry, reset };
}
