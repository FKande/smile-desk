"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { sendFeedback } from "@/lib/chat-client";
import { ASSISTANT_NAME } from "./practice";

type Phase = "ask" | "comment" | "sending" | "thanks" | "failed";

const thumb =
  "inline-flex size-(--control-h-md) cursor-pointer items-center justify-center rounded-full border border-subtle bg-surface text-title " +
  "transition-[background-color,transform] duration-(--duration-fast) ease-out hovered:bg-hover pressed:scale-(--press-scale) focused:focus-ring";

/**
 * One rating for the whole conversation, the feedback loop staff review.
 * 👍 sends at once; 👎 opens an optional comment first ("what went wrong?").
 * Remount (key) per conversation so a new chat asks again.
 */
export function FeedbackPrompt({ conversationId }: { conversationId: string }) {
  const [phase, setPhase] = useState<Phase>("ask");
  const [comment, setComment] = useState("");
  const commentId = useId();

  async function submit(rating: 1 | -1, text?: string) {
    setPhase("sending");
    try {
      await sendFeedback(conversationId, rating, text?.trim() || undefined);
      setPhase("thanks");
    } catch {
      setPhase("failed");
    }
  }

  if (phase === "thanks") {
    return (
      <p role="status" className="mt-4 text-center text-caption text-muted">
        Thank you for the feedback. It helps us make {ASSISTANT_NAME} better.
      </p>
    );
  }

  if (phase === "comment" || (phase === "sending" && comment)) {
    return (
      <form
        className="mt-4 flex flex-col gap-2 rounded-(--card-radius) border border-subtle bg-surface p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(-1, comment);
        }}
      >
        <label htmlFor={commentId} className="text-label font-semibold text-default">
          Sorry about that. What could have gone better? <span className="font-normal text-muted">(optional)</span>
        </label>
        <Textarea
          id={commentId}
          rows={2}
          autoGrow
          maxLength={1000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" loading={phase === "sending"}>
            {phase === "sending" ? "Sending…" : "Send feedback"}
          </Button>
          <Button variant="ghost" onClick={() => setPhase("ask")} disabled={phase === "sending"}>
            Never mind
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div
      role="group"
      aria-label={`Rate this conversation with ${ASSISTANT_NAME}`}
      className="mt-4 flex flex-wrap items-center justify-center gap-2"
    >
      <span className="text-caption text-muted">
        {phase === "failed" ? "That didn't go through. Try again?" : "Was this helpful?"}
      </span>
      <button
        type="button"
        aria-label="Yes, helpful"
        title="Helpful"
        disabled={phase === "sending"}
        onClick={() => void submit(1)}
        className={thumb}
      >
        <span aria-hidden="true">👍</span>
      </button>
      <button
        type="button"
        aria-label="No, not helpful"
        title="Not helpful"
        disabled={phase === "sending"}
        onClick={() => setPhase("comment")}
        className={thumb}
      >
        <span aria-hidden="true">👎</span>
      </button>
    </div>
  );
}
