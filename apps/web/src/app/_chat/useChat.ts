"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChatError,
  fetchTranscript,
  loadConversationId,
  saveConversationId,
  sendMessage,
  type ChatReply,
} from "@/lib/chat-client";
import { restoreThread, turnAttachments, type TurnAttachments } from "@/lib/chat-turns";
import { applyStreamEvent, emptyStream, streamedText } from "@/lib/reply-text";
import { PRACTICE_PHONE } from "./practice";

/* The patient chat's state: the thread, the reply in flight, the last error.
 * One turn at a time; sending while a reply streams is ignored, not queued. */

export type PatientMessage = { id: string; role: "patient"; text: string; at?: Date };

export type AssistantMessage = TurnAttachments & {
  id: string;
  role: "assistant";
  text: string;
  at?: Date;
  /** Already shown as a streaming bubble, so it shouldn't animate in again. */
  streamed: boolean;
};

export type SystemMessage = { id: string; role: "system"; text: string };

export type ChatMessage = PatientMessage | AssistantMessage | SystemMessage;

/** The reply in flight: streamed text so far and the latest tool status. */
export type LiveReply = { text: string; status: string | null };

export type TurnError = { message: string; retryText: string; patientId: string };

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

const patientTexts = (thread: ChatMessage[]) =>
  thread.filter((m): m is PatientMessage => m.role === "patient").map((m) => m.text);

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
        const restored = restoreThread(history, timeOf);
        // Staff were already announced in the restored thread; don't do it again.
        escalatedRef.current = restored.escalated;
        setConversationId(id);
        setMessages(
          restored.messages.map((m): ChatMessage =>
            m.role === "patient" ? { id: newId(), ...m } : { id: newId(), ...m, streamed: true },
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
      // A retry reuses the patient's bubble; the error alert is the only retry control.
      if (!retryOf) setMessages((list) => [...list, { id: patientId, role: "patient", text, at: new Date() }]);
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
        const alreadyEscalated = escalatedRef.current;
        escalatedRef.current ||= Boolean(reply.escalated);

        setMessages((list) => [
          ...list,
          {
            id: newId(),
            role: "assistant",
            text: reply.reply,
            at,
            ...turnAttachments(reply, { alreadyEscalated, patientTexts: patientTexts(list), notifiedAt: timeOf(at) }),
            streamed,
          },
        ]);
      } catch (err) {
        if (controller.signal.aborted) return;
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
