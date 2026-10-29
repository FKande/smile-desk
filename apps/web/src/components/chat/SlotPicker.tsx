"use client";

import { useId, useState, type ReactNode } from "react";
import { Spinner } from "@/components/feedback/Spinner";
import { Icon } from "@/components/icons/Icon";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export type Slot = {
  id: string;
  /** Start time as shown: "9:30 AM". */
  label: string;
  /** Block mode end time: "10:30 AM" renders "9:00 – 10:30 AM". */
  endLabel?: string;
  /** Block mode summary: "3 back-to-back visits". */
  detail?: string;
  /** Defaults to true. Taken slots stay visible so the day's shape is clear. */
  available?: boolean;
  /** Full spoken label, e.g. "Tuesday, November 4 at 9:30 AM". */
  ariaLabel?: string;
  /** Catalog only: freeze a visual state for documentation. */
  state?: "hover" | "focus";
};

export type SlotDay = {
  id: string;
  /** Short heading: "Tue, Nov 4". */
  label: string;
  slots: Slot[];
};

export type SlotPickerProps = {
  days: SlotDay[];
  /** Group name: "Choose a time for your cleaning". */
  legend?: string;
  /** One line under the legend: visit type, length, provider. */
  description?: ReactNode;
  /** "single" = one appointment per slot; "block" = one slot books several
   *  back-to-back visits (family bookings). */
  mode?: "single" | "block";
  value?: string;
  defaultValue?: string;
  onChange?: (slotId: string) => void;
  /** Shows a confirm button once a slot is picked. */
  onConfirm?: (slotId: string) => void;
  confirmLabel?: string;
  /** Always offered: the patient can say no to every option. */
  onNoneWork?: () => void;
  noneWorkLabel?: string;
  onShowMore?: () => void;
  loading?: boolean;
  emptyMessage?: ReactNode;
  /** Locks the picker, e.g. once a booking is confirmed. */
  disabled?: boolean;
  className?: string;
};

/**
 * Open appointment times grouped by day. Built on native radios sharing one
 * name, so arrow keys move between times and screen readers announce "radio,
 * 2 of 9". "None of these work" is always present: rejecting every option is
 * a normal answer, and it hands the conversation back to the assistant to ask
 * what would work instead.
 */
export function SlotPicker({
  days,
  legend = "Choose a time",
  description,
  mode = "single",
  value,
  defaultValue,
  onChange,
  onConfirm,
  confirmLabel = "Book this time",
  onNoneWork,
  noneWorkLabel = "None of these work",
  onShowMore,
  loading = false,
  emptyMessage = "No open times in that range yet.",
  disabled = false,
  className,
}: SlotPickerProps) {
  const name = useId();
  const [internal, setInternal] = useState(defaultValue);
  const selected = value ?? internal;
  const isEmpty = !loading && days.every((day) => day.slots.length === 0);
  const block = mode === "block";

  function pick(slotId: string) {
    setInternal(slotId);
    onChange?.(slotId);
  }

  return (
    <div className="min-w-0 rounded-(--card-radius) border border-(color:--card-border) bg-(--card-bg) p-4 shadow-card">
      <fieldset disabled={disabled || loading} aria-busy={loading || undefined} className="m-0 min-w-0 border-0 p-0">
        <legend className="sr-only">{legend}</legend>
        <div aria-hidden="true" className="mb-1 flex items-center gap-2 text-label font-semibold text-default">
          <Icon name={block ? "users" : "calendar"} size="sm" className="text-brand-text" />
          {legend}
        </div>
        {description ? <p className="text-body-sm text-secondary">{description}</p> : null}

        <div className={cn("mt-4 flex flex-col gap-5", className)}>
          {loading ? (
            <SlotSkeleton />
          ) : isEmpty ? (
            <p className="flex items-start gap-2 rounded-(--control-radius) bg-subtle px-3 py-3 text-body-sm text-secondary">
              <Icon name="calendar-x" size="md" className="mt-0.5 text-muted" />
              <span>{emptyMessage}</span>
            </p>
          ) : (
            days
              .filter((day) => day.slots.length > 0)
              .map((day) => (
                <div key={day.id} role="group" aria-labelledby={`${name}-${day.id}`} className="flex flex-col gap-2">
                  <h3 id={`${name}-${day.id}`} className="text-caption font-semibold text-muted">
                    {day.label}
                  </h3>
                  <div
                    className={cn(
                      "grid gap-2",
                      block ? "grid-cols-1" : "grid-cols-[repeat(auto-fill,minmax(6.75rem,1fr))]",
                    )}
                  >
                    {day.slots.map((slot) => (
                      <SlotOption
                        key={slot.id}
                        slot={slot}
                        name={name}
                        dayLabel={day.label}
                        block={block}
                        checked={selected === slot.id}
                        onPick={pick}
                      />
                    ))}
                  </div>
                </div>
              ))
          )}
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-subtle pt-4">
        {onConfirm ? (
          <Button
            variant="primary"
            iconStart="calendar-check"
            disabled={disabled || loading || selected === undefined}
            onClick={() => selected !== undefined && onConfirm(selected)}
          >
            {confirmLabel}
          </Button>
        ) : null}
        <Button variant="secondary" disabled={disabled} onClick={onNoneWork}>
          {noneWorkLabel}
        </Button>
        {onShowMore ? (
          <Button variant="ghost" iconEnd="chevron-down" disabled={disabled || loading} onClick={onShowMore}>
            Show more times
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function SlotOption({
  slot,
  name,
  dayLabel,
  block,
  checked,
  onPick,
}: {
  slot: Slot;
  name: string;
  dayLabel: string;
  block: boolean;
  checked: boolean;
  onPick: (slotId: string) => void;
}) {
  const available = slot.available !== false;
  const time = slot.endLabel ? `${slot.label} – ${slot.endLabel}` : slot.label;
  const spoken =
    slot.ariaLabel ??
    [`${dayLabel} at ${time}`, slot.detail, available ? null : "unavailable"].filter(Boolean).join(", ");

  return (
    <label
      data-state={slot.state}
      className={cn(
        "relative flex min-h-(--control-h-md) select-none items-center gap-2 rounded-(--control-radius) border px-3 py-2",
        "transition-[background-color,border-color,color] duration-(--duration-fast) ease-out",
        block ? "justify-between" : "justify-center text-center",
        available
          ? cn(
              "cursor-pointer border-(color:--slot-border) bg-(--slot-bg) text-(color:--slot-fg)",
              "hovered:border-(color:--slot-border-hover) hovered:bg-(--slot-bg-hover)",
              "has-checked:border-transparent has-checked:bg-(--slot-bg-selected) has-checked:text-(color:--slot-fg-selected)",
              "focused-within:focus-ring has-disabled:cursor-not-allowed",
            )
          : "cursor-not-allowed border-dashed border-subtle bg-(--slot-bg-unavailable) text-(color:--slot-fg-unavailable)",
      )}
    >
      <input
        type="radio"
        name={name}
        value={slot.id}
        checked={checked}
        disabled={!available}
        onChange={() => onPick(slot.id)}
        aria-label={spoken}
        className="sr-only"
      />
      <span className={cn("flex min-w-0 flex-col", block ? "items-start" : "items-center")} aria-hidden="true">
        <span className={cn("text-label font-semibold tabular-nums", !available && "line-through")}>{time}</span>
        {block && slot.detail ? <span className="text-caption">{slot.detail}</span> : null}
        {!available ? <span className="text-caption">Taken</span> : null}
      </span>
      {checked ? <Icon name="check" size="sm" className={block ? undefined : "absolute right-2 top-2"} /> : null}
    </label>
  );
}

function SlotSkeleton() {
  const block =
    "rounded-(--control-radius) bg-(--skeleton-base) bg-size-[200%_100%] animate-shimmer motion-reduce:animate-none " +
    "bg-[linear-gradient(90deg,var(--skeleton-base)_30%,var(--skeleton-shine)_50%,var(--skeleton-base)_70%)]";
  return (
    <div className="flex flex-col gap-5">
      <p className="flex items-center gap-2 text-body-sm text-secondary">
        <Spinner size="sm" label="" />
        <span role="status">Checking the schedule</span>
      </p>
      {[0, 1].map((row) => (
        <div key={row} aria-hidden="true" className="flex flex-col gap-2">
          <span className={cn(block, "h-3.5 w-24")} />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(6.75rem,1fr))] gap-2">
            {[0, 1, 2].map((cell) => (
              <span key={cell} className={cn(block, "h-(--control-h-md)")} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
