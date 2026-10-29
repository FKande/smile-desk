import type { HTMLAttributes, ReactNode } from "react";
import { Spinner } from "@/components/feedback/Spinner";
import { Icon } from "@/components/icons/Icon";
import { cn } from "@/lib/cn";
import { AssistantMark } from "./AssistantMark";

export type MessageSender = "patient" | "assistant" | "system";
/** Where the message sits in a run of consecutive messages from one sender. */
export type MessagePosition = "single" | "first" | "middle" | "last";
export type DeliveryStatus = "sent" | "sending" | "failed";

export type MessageBubbleProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  sender: MessageSender;
  position?: MessagePosition;
  /** Display string ("9:04 AM"). Shown under the last message of a run. */
  timestamp?: string;
  /** Machine-readable time for the <time> element. */
  dateTime?: string;
  /** Patient messages only. "sent" renders nothing extra. */
  status?: DeliveryStatus;
  onRetry?: () => void;
  /** Spoken before the message so the log reads "Smile Desk: …". */
  senderName?: string;
  /** Message text. Optional when the message is only rich content. */
  children?: ReactNode;
  /** Rich content under the bubble: quick replies, a slot picker, a card. */
  attachment?: ReactNode;
  /** Arrival animation; turn off when rendering history. */
  animate?: boolean;
};

const bubbleColors: Record<Exclude<MessageSender, "system">, string> = {
  patient: "bg-(--bubble-patient-bg) text-(color:--bubble-patient-fg) border-transparent",
  assistant:
    "bg-(--bubble-assistant-bg) text-(color:--bubble-assistant-fg) border-(color:--bubble-assistant-border) shadow-raised",
};

/* The speaker-side corners tighten to --bubble-radius-tail: the bottom one on
 * every bubble (it points at the speaker), the top one once a run continues,
 * so a run reads as one stacked block. */
const tailCorners: Record<Exclude<MessageSender, "system">, { top: string; bottom: string }> = {
  patient: { top: "rounded-tr-(--bubble-radius-tail)", bottom: "rounded-br-(--bubble-radius-tail)" },
  assistant: { top: "rounded-tl-(--bubble-radius-tail)", bottom: "rounded-bl-(--bubble-radius-tail)" },
};

/** One chat message. Spacing between runs lives here (a run starts with a
 *  wider gap), so MessageList stays a plain column. */
export function MessageBubble({
  sender,
  position = "single",
  timestamp,
  dateTime,
  status = "sent",
  onRetry,
  senderName,
  children,
  attachment,
  animate = true,
  className,
  ...rest
}: MessageBubbleProps) {
  const startsRun = position === "single" || position === "first";
  const endsRun = position === "single" || position === "last";

  if (sender === "system") {
    return (
      <div
        data-sender="system"
        className={cn(
          "my-3 flex justify-center px-6 text-center text-caption text-(color:--bubble-system-fg)",
          animate && "animate-fade-in",
          className,
        )}
        {...rest}
      >
        <p>{children}</p>
      </div>
    );
  }

  const isPatient = sender === "patient";
  const name = senderName ?? (isPatient ? "You" : "Smile Desk");
  const corners = tailCorners[sender];

  return (
    <div
      data-sender={sender}
      data-position={position}
      data-status={isPatient ? status : undefined}
      className={cn(
        "flex items-end gap-2",
        isPatient ? "justify-end pl-10" : "pr-6",
        startsRun ? "mt-3 first:mt-0" : "mt-0",
        animate && "animate-rise-in",
        className,
      )}
      {...rest}
    >
      {isPatient ? null : endsRun ? (
        /* The mark sits beside the last bubble of a run; a spacer keeps the
         * earlier bubbles aligned with it. */
        <AssistantMark className="mb-0.5 self-end" />
      ) : (
        <span aria-hidden="true" className="w-8 shrink-0" />
      )}

      <div
        className={cn("flex min-w-0 max-w-[min(100%,34rem)] flex-col gap-2", isPatient ? "items-end" : "items-start")}
      >
        {children ? (
          <div
            className={cn(
              "w-fit max-w-full whitespace-pre-wrap break-words rounded-(--bubble-radius) border px-4 py-2.5 text-body",
              bubbleColors[sender],
              corners.bottom,
              !startsRun && corners.top,
              status === "sending" && "opacity-70",
            )}
          >
            <span className="sr-only">{name}: </span>
            {children}
          </div>
        ) : (
          <span className="sr-only">{name}:</span>
        )}

        {attachment ? <div className="w-full min-w-0">{attachment}</div> : null}

        {isPatient && status === "sending" ? (
          <p className="flex items-center gap-1.5 text-caption text-muted">
            <Spinner size="sm" label="" />
            Sending
          </p>
        ) : null}

        {isPatient && status === "failed" ? (
          <p role="alert" className="flex flex-wrap items-center justify-end gap-x-1 text-caption text-danger-text">
            <Icon name="alert-triangle" size="sm" />
            <span>Not sent.</span>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className={cn(
                  "inline-flex min-h-(--control-h-md) cursor-pointer items-center gap-1 rounded-sm px-2 font-semibold underline underline-offset-2",
                  "hovered:text-default focused:focus-ring",
                )}
              >
                <Icon name="refresh" size="sm" />
                Try again
              </button>
            ) : null}
          </p>
        ) : null}

        {timestamp && endsRun && status !== "failed" && status !== "sending" ? (
          <time dateTime={dateTime} className="px-1 text-caption text-muted">
            {timestamp}
          </time>
        ) : null}
      </div>
    </div>
  );
}
