import { cn } from "@/lib/cn";

/* Shared by Button, IconButton and anything that must look like a button
 * (e.g. a next/link CTA): buttonClasses({ variant: "secondary" }).
 *
 * Conventions every component in this system follows:
 *  - colors come from tier-3 tokens via the var shorthand: bg-(--x),
 *    text-(color:--x), border-(color:--x) (type hints avoid size/width ambiguity)
 *  - interactive states use the custom variants from styles/theme.css:
 *    hovered: pressed: focused: is-disabled:, which also match a forced
 *    data-state so /design-system can render every state statically. */

export const buttonVariants = ["primary", "secondary", "ghost", "danger"] as const;
export type ButtonVariant = (typeof buttonVariants)[number];

export const buttonSizes = ["sm", "md", "lg"] as const;
export type ButtonSize = (typeof buttonSizes)[number];

const base =
  "relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap " +
  "rounded-(--button-radius) border font-semibold " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-(--duration-fast) ease-out " +
  "pressed:scale-(--press-scale) focused:focus-ring " +
  "is-disabled:cursor-not-allowed is-disabled:border-transparent is-disabled:bg-(--button-disabled-bg) " +
  "is-disabled:text-(color:--button-disabled-fg) is-disabled:shadow-none " +
  "data-loading:cursor-wait";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-(--button-primary-bg) text-(color:--button-primary-fg) shadow-raised " +
    "hovered:bg-(--button-primary-bg-hover)",
  secondary:
    "border-(color:--button-secondary-border) bg-(--button-secondary-bg) text-(color:--button-secondary-fg) " +
    "hovered:border-(color:--button-secondary-border-hover) hovered:bg-(--button-secondary-bg-hover)",
  ghost:
    "border-transparent bg-transparent text-(color:--button-ghost-fg) " +
    "hovered:bg-(--button-ghost-bg-hover) hovered:text-default",
  danger:
    "border-transparent bg-(--button-danger-bg) text-(color:--button-danger-fg) shadow-raised " +
    "hovered:bg-(--button-danger-bg-hover)",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-(--control-h-sm) px-4 text-label",
  md: "h-(--control-h-md) px-5 text-label",
  lg: "h-(--control-h-lg) px-6 text-body",
};

const iconOnlySizes: Record<ButtonSize, string> = {
  sm: "size-(--control-h-sm)",
  md: "size-(--control-h-md)",
  lg: "size-(--control-h-lg)",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  iconOnly = false,
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  fullWidth?: boolean;
  className?: string;
}) {
  return cn(
    base,
    variants[variant],
    iconOnly ? iconOnlySizes[size] : sizes[size],
    fullWidth && "w-full",
    className,
  );
}
