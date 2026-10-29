import { Icon } from "@/components/icons/Icon";
import { cn } from "@/lib/cn";

const sizes = {
  sm: { box: "size-8", icon: "sm" },
  md: { box: "size-10", icon: "md" },
  lg: { box: "size-12", icon: "lg" },
} as const;

export type AssistantMarkProps = {
  size?: keyof typeof sizes;
  className?: string;
};

/** The assistant's tooth mark, used beside its messages and in the header.
 *  Decorative: the sender is always named in text next to it. Kept local to
 *  chat so the bubble does not depend on the general-purpose Avatar. */
export function AssistantMark({ size = "sm", className }: AssistantMarkProps) {
  const { box, icon } = sizes[size];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        "bg-(--avatar-assistant-bg) text-(color:--avatar-assistant-fg)",
        box,
        className,
      )}
    >
      <Icon name="tooth" size={icon} />
    </span>
  );
}
