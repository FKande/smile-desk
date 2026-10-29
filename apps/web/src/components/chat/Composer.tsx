"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";

export type ComposerProps = Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit" | "onChange" | "children"> & {
  /** Called with the trimmed text. The composer clears itself when uncontrolled. */
  onSend: (text: string) => void;
  /** Controlled text. Pair with onValueChange. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** The assistant is replying: typing stays allowed, sending waits. */
  busy?: boolean;
  disabled?: boolean;
  /** The field's label. Hidden visually unless labelVisible, always read. */
  label?: string;
  labelVisible?: boolean;
  placeholder?: string;
  /** A short line under the field: keyboard hint, privacy note. */
  hint?: ReactNode;
  /** Grows with the text up to this many lines, then scrolls. */
  maxRows?: number;
  /** Catalog only: freeze the focused look on the field container. */
  "data-state"?: "focus";
};

/**
 * Where the patient types. The field grows with the message (up to ~6 lines),
 * Enter sends and Shift+Enter starts a new line, and the whole pill shows the
 * focus ring so it reads as one control. Bottom padding clears the iOS home
 * indicator when the composer is pinned to the bottom of the screen.
 */
export function Composer({
  onSend,
  value,
  defaultValue = "",
  onValueChange,
  busy = false,
  disabled = false,
  label = "Message Smile Desk",
  labelVisible = false,
  placeholder = "Type your message",
  hint,
  maxRows = 6,
  "data-state": forcedState,
  className,
  ...rest
}: ComposerProps) {
  const fieldId = useId();
  const hintId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [internal, setInternal] = useState(defaultValue);
  const text = value ?? internal;
  const canSend = text.trim().length > 0 && !busy && !disabled;

  // Grow to fit: reset, then take the content height. max-height (in lh, so
  // it tracks the text-size setting) caps it and the field scrolls after that.
  useLayoutEffect(() => {
    const field = textareaRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
    // scrollHeight is rounded to whole pixels while the line box is fractional,
    // so a one-line field can overflow by under a pixel and show a scrollbar.
    // Only allow scrolling once the field has actually hit its max height.
    const maxHeight = parseFloat(getComputedStyle(field).maxHeight);
    field.style.overflowY = field.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [text]);

  function update(next: string) {
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
  }

  function send() {
    if (!canSend) return;
    onSend(text.trim());
    update("");
    textareaRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // isComposing: Enter confirms an IME candidate (Japanese, Chinese …), it must not send.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]", className)}
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
      {...rest}
    >
      <label htmlFor={fieldId} className={labelVisible ? "px-1 text-label font-semibold text-default" : "sr-only"}>
        {label}
      </label>
      <div
        data-state={forcedState}
        className={cn(
          "flex items-end gap-2 rounded-(--composer-radius) border bg-(--composer-bg) py-1.5 pl-4 pr-1.5",
          "border-(color:--composer-border) transition-[border-color,box-shadow] duration-(--duration-fast) ease-out",
          "focused-within:border-(color:--composer-border-focus) focused-within:focus-ring",
          disabled && "bg-(--input-bg-disabled)",
        )}
      >
        <textarea
          ref={textareaRef}
          id={fieldId}
          rows={1}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          aria-describedby={hint ? hintId : undefined}
          enterKeyHint="send"
          onChange={(event) => update(event.target.value)}
          onKeyDown={handleKeyDown}
          style={{ maxHeight: `calc(${maxRows}lh + 1.25rem)` }}
          className={cn(
            "min-h-(--control-h-md) flex-1 resize-none bg-transparent py-2.5 text-body text-(color:--input-fg)",
            "placeholder:text-(color:--input-placeholder) outline-none focus-visible:outline-none",
            "disabled:cursor-not-allowed",
          )}
        />
        <IconButton
          type="submit"
          icon="arrow-up"
          label={busy ? "Send (waiting for the reply)" : "Send message"}
          variant="primary"
          disabled={!canSend}
        />
      </div>
      {hint ? (
        <p id={hintId} className="px-4 text-caption text-muted">
          {hint}
        </p>
      ) : null}
    </form>
  );
}
