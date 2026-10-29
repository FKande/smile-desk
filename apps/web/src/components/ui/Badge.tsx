import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons/Icon";
import { cn } from "@/lib/cn";

export const tones = ["neutral", "brand", "accent", "success", "warning", "danger", "info"] as const;
export type Tone = (typeof tones)[number];

const variants = {
  soft: "bg-(--tone-subtle) text-(color:--tone-text) border-transparent",
  outline: "bg-transparent text-(color:--tone-text) border-(color:--tone-border)",
  solid: "bg-(--tone-solid) text-(color:--tone-on-solid) border-transparent",
} as const;
export type BadgeVariant = keyof typeof variants;

type BadgeProps = {
  tone?: Tone;
  variant?: BadgeVariant;
  /** Status is never color alone: pair a tone with an icon or a clear word. */
  icon?: IconName;
  className?: string;
  children: ReactNode;
};

/** A short status or category label. data-tone retargets the --tone-* tokens
 *  (styles/components.css), so one set of classes serves every intent. */
export function Badge({ tone = "neutral", variant = "soft", icon, className, children }: BadgeProps) {
  return (
    <span
      data-tone={tone}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-caption font-semibold",
        variants[variant],
        className,
      )}
    >
      {icon ? <Icon name={icon} size="sm" /> : null}
      {children}
    </span>
  );
}
