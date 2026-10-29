import { cn } from "@/lib/cn";
import { AssistantMark } from "./AssistantMark";

export type TypingIndicatorProps = {
  /** Who is typing, for the spoken and reduced-motion label. */
  name?: string;
  className?: string;
};

/* Staggered so the dots ripple left to right within one --animate-typing loop. */
const delays = ["0ms", "160ms", "320ms"];

/** Three dots in an assistant-style bubble while a reply is on its way.
 *  Under reduced motion the dots hold still and a word says what they meant. */
export function TypingIndicator({ name = "Smile Desk", className }: TypingIndicatorProps) {
  return (
    <div role="status" className={cn("mt-3 flex items-end gap-2 first:mt-0 animate-fade-in", className)}>
      <AssistantMark className="mb-0.5" />
      <div
        className={cn(
          "inline-flex h-11 items-center gap-1.5 rounded-(--bubble-radius) rounded-bl-(--bubble-radius-tail) border px-4",
          "border-(color:--bubble-assistant-border) bg-(--bubble-assistant-bg) shadow-raised",
        )}
      >
        {delays.map((delay) => (
          <span
            key={delay}
            aria-hidden="true"
            style={{ animationDelay: delay }}
            className="size-2 rounded-full bg-(--typing-dot) animate-typing motion-reduce:animate-none"
          />
        ))}
        <span aria-hidden="true" className="hidden pl-1 text-caption text-muted motion-reduce:inline">
          Typing
        </span>
      </div>
      <span className="sr-only">{name} is typing</span>
    </div>
  );
}
