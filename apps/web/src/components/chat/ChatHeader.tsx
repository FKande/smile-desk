import type { HTMLAttributes, ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { AssistantMark } from "./AssistantMark";

export type ChatHeaderProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  assistantName?: string;
  practiceName?: string;
  /** Reply expectation: "Usually replies right away". */
  status?: string;
  /** Today's hours: "Open today 8 AM – 6 PM". */
  hours?: string;
  /** Office open / assistant live. Turns the status dot from green to grey;
   *  the status text must say the same in words. */
  available?: boolean;
  /** Shows the "Talk to a person" action. */
  onTalkToPerson?: () => void;
  talkToPersonLabel?: string;
  /** Slot for preference controls (ThemeToggle, TextSizeToggle). */
  controls?: ReactNode;
};

/**
 * Top of the chat: who you are talking to, on behalf of which practice, how
 * quickly they answer, and an always-visible way to reach a human. Sticky in a
 * scrolling layout; the status dot is paired with words, never alone.
 */
export function ChatHeader({
  assistantName = "Smile Desk",
  practiceName = "Smile Desk Dental",
  status = "Usually replies right away",
  hours,
  available = true,
  onTalkToPerson,
  talkToPersonLabel = "Talk to a person",
  controls,
  className,
  ...rest
}: ChatHeaderProps) {
  return (
    <header
      className={cn(
        "@container sticky top-0 z-(--z-sticky) flex flex-col gap-3 border-b border-subtle bg-surface px-(--gutter) py-3",
        className,
      )}
      {...rest}
    >
      <div className="flex items-center gap-3">
        <AssistantMark size="md" />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-label font-semibold text-default">
            {assistantName}
            <span className="font-normal text-muted"> · {practiceName}</span>
          </p>
          <p className="flex items-center gap-1.5 truncate text-caption text-secondary">
            <span
              aria-hidden="true"
              className={cn("size-2 shrink-0 rounded-full", available ? "bg-success-solid" : "bg-active")}
            />
            {status}
            {hours ? <span className="truncate text-muted"> · {hours}</span> : null}
          </p>
        </div>
        {onTalkToPerson ? (
          // Phone-width headers collapse the action to a round icon button so
          // the practice name and status line keep their room; the label stays
          // as the accessible name and the native tooltip.
          <Button
            variant="secondary"
            iconStart="headset"
            onClick={onTalkToPerson}
            title={talkToPersonLabel}
            className="@max-md:w-(--control-h-md) @max-md:px-0"
          >
            <span className="@max-md:sr-only">{talkToPersonLabel}</span>
          </Button>
        ) : null}
      </div>
      {controls ? <div className="flex flex-wrap items-center justify-end gap-2">{controls}</div> : null}
    </header>
  );
}
