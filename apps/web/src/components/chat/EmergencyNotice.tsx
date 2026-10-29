import { useId, type HTMLAttributes } from "react";
import { Icon } from "@/components/icons/Icon";
import { cn } from "@/lib/cn";

export type EmergencyNoticeProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  /** The patient's emergency, in their words or a short faithful summary. */
  summary: string;
  /** When staff were alerted: "2:14 PM". */
  notifiedAt: string;
  /** Display form: "(555) 010-2400". The tel: link is derived from it. */
  phone?: string;
  practiceName?: string;
};

/** "(555) 010-2400" → "tel:+15550102400" (US numbers; anything else as typed). */
function telHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `tel:${digits.length === 10 ? `+1${digits}` : digits}`;
}

/**
 * Shown after an emergency is reported. Danger-toned but quiet: it confirms
 * the team knows (and when), plays back what was reported so the patient can
 * correct it, and gives the two ways to get help faster. Calm wording first,
 * the 911 line last and plain.
 */
export function EmergencyNotice({
  summary,
  notifiedAt,
  phone = "(555) 010-2400",
  practiceName = "Bright Smile Dental",
  className,
  ...rest
}: EmergencyNoticeProps) {
  const titleId = useId();
  return (
    <section
      data-tone="danger"
      aria-labelledby={titleId}
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-(--card-radius) border border-(color:--tone-border) bg-(--tone-subtle) p-4",
        className,
      )}
      {...rest}
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-(--tone-element) text-(color:--tone-text)"
        >
          <Icon name="bell" size="md" />
        </span>
        <div className="flex min-w-0 flex-col">
          <h3 id={titleId} className="text-title font-semibold text-(color:--tone-text)">
            The office team has been notified
          </h3>
          <p className="text-body-sm text-secondary">
            Sent to the {practiceName} front desk at <time>{notifiedAt}</time>. Someone will call you shortly.
          </p>
        </div>
      </header>

      <div className="rounded-(--control-radius) bg-surface px-3 py-2.5">
        <p className="text-caption font-semibold text-muted">What we shared with them</p>
        <blockquote className="text-body-sm text-default">{summary}</blockquote>
      </div>

      <a
        href={telHref(phone)}
        className={cn(
          "inline-flex min-h-(--control-h-md) w-fit items-center gap-2 rounded-(--button-radius) border px-5 text-label font-semibold",
          "border-(color:--tone-border) bg-surface text-(color:--tone-text)",
          "transition-colors duration-(--duration-fast) ease-out hovered:bg-(--tone-element) focused:focus-ring",
        )}
      >
        <Icon name="phone" size="sm" />
        Call {phone}
      </a>

      <p className="flex items-start gap-2 text-body-sm text-default">
        <Icon name="alert-triangle" size="sm" className="mt-1 text-(color:--tone-text)" />
        <span>
          If you have severe swelling, trouble breathing or uncontrolled bleeding, call{" "}
          <a href="tel:911" className="font-semibold underline underline-offset-2 focused:focus-ring">
            911
          </a>
          .
        </span>
      </p>
    </section>
  );
}
