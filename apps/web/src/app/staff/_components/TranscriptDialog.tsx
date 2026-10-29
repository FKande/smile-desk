"use client";

import { useEffect, useState } from "react";
import { SkeletonText } from "@/components/feedback/Skeleton";
import { Alert } from "@/components/ui/Alert";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import { fetchTranscript, type TranscriptMessage } from "@/lib/chat-client";
import type { FeedbackEntry } from "@/lib/staff-client";
import { ASSISTANT_NAME } from "@/app/_chat/practice";
import { absoluteTime } from "./time";

type TranscriptDialogProps = {
  /** The rating whose conversation to show; null keeps the dialog closed. */
  entry: FeedbackEntry | null;
  onClose: () => void;
};

/** A read-only copy of the chat that earned a rating. */
export function TranscriptDialog({ entry, onClose }: TranscriptDialogProps) {
  return (
    <Dialog
      open={entry !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      icon="message"
      size="lg"
      title="Conversation"
      description={
        entry ? `${entry.patientName ?? "Unverified patient"} · rated ${absoluteTime(entry.createdAt)}` : undefined
      }
    >
      {/* Keyed so each conversation starts from its own loading state. */}
      {entry ? <Transcript key={entry.conversationId} conversationId={entry.conversationId} /> : null}
    </Dialog>
  );
}

function Transcript({ conversationId }: { conversationId: string }) {
  const [messages, setMessages] = useState<TranscriptMessage[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchTranscript(conversationId, controller.signal).then(setMessages, () => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [conversationId]);

  if (failed) {
    return <Alert tone="danger" title="Couldn't load this conversation" description="Close this and try again in a moment." />;
  }
  if (messages === null) {
    return (
      <div aria-busy="true">
        <span className="sr-only">Loading the conversation</span>
        <SkeletonText lines={4} />
      </div>
    );
  }
  if (messages.length === 0) return <p className="text-body-sm text-secondary">This conversation has no messages.</p>;

  return (
    <ol className="flex max-h-[60dvh] flex-col gap-3 overflow-y-auto">
      {messages.map((m, i) => {
        const patient = m.role === "patient";
        return (
          <li
            key={i}
            className={cn("flex flex-col gap-1 rounded-lg p-3", patient ? "bg-brand-subtle" : "bg-subtle")}
          >
            <span className="text-caption font-semibold text-secondary">{patient ? "Patient" : ASSISTANT_NAME}</span>
            <p className="whitespace-pre-wrap break-words text-body-sm">{m.text}</p>
          </li>
        );
      })}
    </ol>
  );
}
