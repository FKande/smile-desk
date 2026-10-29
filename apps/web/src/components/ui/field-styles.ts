import { cn } from "@/lib/cn";

/* Shared by Input, Textarea and Select so every text-like control has one
 * visual language: same border, hover, focus, invalid and disabled states.
 *
 * Invalid is applied from a prop (not the aria-invalid: variant) so it can
 * win over hover and focus cleanly: an invalid field keeps its danger border
 * while hovered or focused, and focus adds the ring on top. */

export const controlSizes = ["md", "lg"] as const;
export type ControlSize = (typeof controlSizes)[number];

const base =
  "w-full min-w-0 rounded-(--control-radius) border bg-(--input-bg) text-body text-(color:--input-fg) " +
  "placeholder:text-(color:--input-placeholder) " +
  "transition-[background-color,border-color,box-shadow] duration-(--duration-fast) ease-out " +
  "focused:focus-ring " +
  "is-disabled:cursor-not-allowed is-disabled:border-subtle is-disabled:bg-(--input-bg-disabled) " +
  "is-disabled:text-disabled is-disabled:placeholder:text-disabled";

const valid =
  "border-(color:--input-border) hovered:border-(color:--input-border-hover) focused:border-(color:--input-border-focus)";

const invalidState = "border-(color:--input-border-invalid)";

/* Single-line heights. Text stays at 17px in both sizes: anything under 16px
 * makes iOS Safari zoom the page on focus. */
const sizes: Record<ControlSize, string> = {
  md: "h-(--control-h-md) px-3.5",
  lg: "h-(--control-h-lg) px-4",
};

export function controlClasses({
  invalid = false,
  size,
  className,
}: {
  invalid?: boolean;
  /** Omit for multi-line controls (Textarea) that size by rows. */
  size?: ControlSize;
  className?: string;
}) {
  return cn(base, invalid ? invalidState : valid, size && sizes[size], className);
}

/* Read-only text stays fully legible (unlike disabled) and is still focusable
 * and copyable; only the fill changes to say "you can't edit this here". */
export const readOnlyClasses = "[&:read-only:not(:disabled)]:bg-(--input-bg-readonly)";
