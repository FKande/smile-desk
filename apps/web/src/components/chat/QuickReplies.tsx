"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/icons/Icon";
import { cn } from "@/lib/cn";

export type QuickReply = {
  value: string;
  label: string;
  icon?: IconName;
};

export type QuickRepliesProps = {
  options: readonly QuickReply[];
  /** Controlled pick. Leave undefined to let the group track it. */
  value?: string;
  /** Uncontrolled initial pick (e.g. when rendering history). */
  defaultValue?: string;
  onSelect?: (value: string) => void;
  /** Locks the group without a pick, e.g. while the assistant is replying. */
  disabled?: boolean;
  /** Names the group for assistive tech. */
  label?: string;
  className?: string;
};

const chip =
  "inline-flex min-h-(--control-h-md) items-center gap-1.5 rounded-full border px-4 py-2 text-left text-label font-semibold " +
  "transition-[background-color,border-color,color,transform] duration-(--duration-fast) ease-out";

const live =
  "cursor-pointer border-(color:--chip-border) bg-(--chip-bg) text-(color:--chip-fg) " +
  "hovered:bg-(--chip-bg-hover) pressed:scale-(--press-scale) focused:focus-ring";

const picked = "border-transparent bg-(--chip-bg-selected) text-(color:--chip-fg-selected)";
const passedOver = "border-subtle bg-transparent text-muted";

/**
 * Suggested replies under an assistant message. One tap answers; the group
 * then locks and keeps the chosen chip highlighted (with a check, not just a
 * color), so scrolling back shows what was said. Patients can always type
 * instead, so chips are a shortcut and never the only way forward.
 */
export function QuickReplies({
  options,
  value,
  defaultValue,
  onSelect,
  disabled = false,
  label = "Suggested replies",
  className,
}: QuickRepliesProps) {
  const [internal, setInternal] = useState(defaultValue);
  const chosen = value ?? internal;
  const locked = disabled || chosen !== undefined;

  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const isChosen = option.value === chosen;
        return (
          <button
            key={option.value}
            type="button"
            disabled={locked}
            aria-pressed={chosen !== undefined ? isChosen : undefined}
            onClick={() => {
              setInternal(option.value);
              onSelect?.(option.value);
            }}
            className={cn(
              chip,
              !locked && live,
              locked && (isChosen ? picked : passedOver),
              locked && !isChosen && "cursor-not-allowed",
            )}
          >
            {isChosen ? <Icon name="check" size="sm" /> : option.icon ? <Icon name={option.icon} size="sm" /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
