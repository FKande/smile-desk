import type { HTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons/Icon";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";

export const alertTones = ["info", "success", "warning", "danger", "neutral", "brand"] as const;
export type AlertTone = (typeof alertTones)[number];

/* A distinct glyph per tone, so the intent never rests on color alone. */
const defaultIcons: Record<AlertTone, IconName> = {
  info: "info",
  success: "check-circle",
  warning: "alert-triangle",
  danger: "x-circle",
  neutral: "info",
  brand: "tooth",
};

type AlertProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  tone?: AlertTone;
  title?: ReactNode;
  description?: ReactNode;
  /** Override the tone's glyph, or pass null for none. */
  icon?: IconName | null;
  /** Buttons or links shown under the text. */
  actions?: ReactNode;
  /** Shows a dismiss button when set. */
  onDismiss?: () => void;
  dismissLabel?: string;
  /** Interrupts assistive tech (role="alert"). On by default for danger only;
   *  everything else is a polite role="status". */
  urgent?: boolean;
};

/** An inline message inside the flow of a page or conversation. data-tone
 *  retargets the --tone-* tokens (styles/components.css), as Badge does. */
export function Alert({
  tone = "info",
  title,
  description,
  icon,
  actions,
  onDismiss,
  dismissLabel = "Dismiss",
  urgent,
  className,
  children,
  ...rest
}: AlertProps) {
  const glyph = icon === undefined ? defaultIcons[tone] : icon;
  const isUrgent = urgent ?? tone === "danger";
  return (
    <div
      role={isUrgent ? "alert" : "status"}
      data-tone={tone}
      className={cn(
        "flex items-start gap-3 rounded-(--alert-radius) border border-(color:--tone-border) bg-(--tone-subtle) px-4 py-3.5",
        className,
      )}
      {...rest}
    >
      {glyph ? (
        <span className="mt-0.5 text-(color:--tone-text)">
          <Icon name={glyph} />
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title ? <p className="text-body font-semibold text-(color:--tone-text)">{title}</p> : null}
        {description ? <div className="text-body-sm text-default">{description}</div> : null}
        {children}
        {actions ? <div className="mt-2 flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {onDismiss ? (
        <IconButton icon="x" label={dismissLabel} onClick={onDismiss} className="-my-1.5 -mr-2" />
      ) : null}
    </div>
  );
}
