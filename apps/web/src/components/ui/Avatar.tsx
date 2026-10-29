import { Icon, type IconSize } from "@/components/icons/Icon";
import { cn } from "@/lib/cn";

export const avatarKinds = ["assistant", "patient", "staff"] as const;
export type AvatarKind = (typeof avatarKinds)[number];

const kinds: Record<AvatarKind, string> = {
  assistant: "bg-(--avatar-assistant-bg) text-(color:--avatar-assistant-fg)",
  patient: "bg-(--avatar-patient-bg) text-(color:--avatar-patient-fg)",
  staff: "bg-(--avatar-staff-bg) text-(color:--avatar-staff-fg)",
};

const sizes = {
  sm: { box: "size-8 text-caption", icon: "sm" },
  md: { box: "size-10 text-label", icon: "md" },
  lg: { box: "size-12 text-body", icon: "lg" },
} as const satisfies Record<string, { box: string; icon: IconSize }>;
export type AvatarSize = keyof typeof sizes;

type AvatarProps = {
  kind: AvatarKind;
  /** Patient name, used for initials ("Maria Lopez" → "ML"). */
  name?: string;
  size?: AvatarSize;
  /** Decorative by default: the speaker is usually named next to it. Pass a
   *  label only when the avatar stands alone. */
  label?: string;
  className?: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** Who is speaking: the assistant (tooth), a patient (initials, falling back
 *  to a person glyph) or front-desk staff (headset). */
export function Avatar({ kind, name, size = "md", label, className }: AvatarProps) {
  const { box, icon } = sizes[size];
  const text = kind === "patient" && name ? initials(name) : "";
  const glyph = kind === "assistant" ? "tooth" : kind === "staff" ? "headset" : "user";
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold",
        kinds[kind],
        box,
        className,
      )}
    >
      {text || <Icon name={glyph} size={icon} />}
    </span>
  );
}
