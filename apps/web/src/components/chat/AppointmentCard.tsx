import type { HTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons/Icon";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export type AppointmentType = "cleaning" | "checkup" | "emergency";
export type AppointmentStatus = "confirmed" | "rescheduled" | "cancelled" | "pending";

export type AppointmentMember = {
  name: string;
  /** This person's own start time: "9:00 AM". */
  time: string;
  /** Only when it differs from the card's type. */
  type?: AppointmentType;
};

export type AppointmentCardProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  type: AppointmentType;
  status: AppointmentStatus;
  /** Single booking. For a family booking pass members instead. */
  patientName?: string;
  /** Family booking: one row per person, back to back. */
  members?: AppointmentMember[];
  /** "Friday, November 7". */
  date: string;
  /** "10:15 AM", or a range for a family block: "9:00 – 10:30 AM". */
  time: string;
  /** "60 min". */
  duration: string;
  location?: string;
  /** Rescheduled: where it used to be, shown struck through. */
  previousTime?: string;
  /** Confirmation code the front desk can look up. */
  reference?: string;
  onReschedule?: () => void;
  onCancel?: () => void;
  onAddToCalendar?: () => void;
};

const typeMeta: Record<AppointmentType, { label: string; icon: IconName; tone: Tone }> = {
  cleaning: { label: "Cleaning", icon: "sparkles", tone: "brand" },
  checkup: { label: "General checkup", icon: "stethoscope", tone: "brand" },
  emergency: { label: "Emergency visit", icon: "siren", tone: "danger" },
};

const statusMeta: Record<AppointmentStatus, { label: string; icon: IconName; tone: Tone }> = {
  confirmed: { label: "Confirmed", icon: "check-circle", tone: "success" },
  rescheduled: { label: "Rescheduled", icon: "refresh", tone: "info" },
  cancelled: { label: "Cancelled", icon: "x-circle", tone: "neutral" },
  pending: { label: "Pending", icon: "clock", tone: "warning" },
};

/**
 * The booking, summarized: what, who, when, where, and what can still be done
 * with it. Status is a badge with an icon and a word; a cancelled card fades
 * back, strikes its time and says so in a sentence, and loses its actions.
 */
export function AppointmentCard({
  type,
  status,
  patientName,
  members,
  date,
  time,
  duration,
  location = "Bright Smile Dental, 120 Main Street",
  previousTime,
  reference,
  onReschedule,
  onCancel,
  onAddToCalendar,
  className,
  ...rest
}: AppointmentCardProps) {
  const kind = typeMeta[type];
  const state = statusMeta[status];
  const cancelled = status === "cancelled";
  const family = members && members.length > 0;
  const hasActions = !cancelled && (onReschedule || onCancel || onAddToCalendar);

  return (
    <article
      aria-label={`${kind.label}, ${state.label.toLowerCase()}, ${date} at ${time}`}
      data-status={status}
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-(--card-radius) border border-(color:--card-border) bg-(--card-bg) p-4",
        cancelled ? "bg-subtle" : "shadow-card",
        className,
      )}
      {...rest}
    >
      {/* Wraps: inside a chat bubble on a phone the card is ~17rem wide, too
          narrow for icon + title + badge, so the badge drops below instead of
          covering the title. */}
      <header className="flex flex-wrap items-start gap-3">
        <span
          data-tone={kind.tone}
          aria-hidden="true"
          className={cn(
            "inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-(--tone-subtle) text-(color:--tone-text)",
            cancelled && "opacity-60",
          )}
        >
          <Icon name={kind.icon} size="md" />
        </span>
        <div className="flex min-w-36 flex-1 flex-col">
          <h3 className={cn("text-title font-semibold", cancelled && "text-muted")}>{kind.label}</h3>
          {family ? (
            <p className="text-body-sm text-secondary">{members.length} back-to-back visits</p>
          ) : patientName ? (
            <p className="text-body-sm text-secondary">For {patientName}</p>
          ) : null}
        </div>
        <Badge tone={state.tone} icon={state.icon}>
          {state.label}
        </Badge>
      </header>

      {cancelled ? (
        <p className="text-body-sm text-secondary">
          This appointment was cancelled. The time is free for someone else.
        </p>
      ) : null}

      <dl className={cn("flex flex-col gap-2.5 text-body-sm", cancelled ? "text-muted" : "text-default")}>
        <Detail icon="calendar" term="When">
          <span className={cn("font-semibold", cancelled && "line-through")}>
            {date} · {time}
          </span>
          {previousTime ? (
            <span className="block text-muted">
              Moved from <s>{previousTime}</s>
            </span>
          ) : null}
        </Detail>
        <Detail icon="clock" term="Length">
          {duration}
        </Detail>
        <Detail icon="map-pin" term="Where">
          {location}
        </Detail>
        {reference ? (
          <Detail icon="shield-check" term="Confirmation">
            <span className="font-mono">{reference}</span>
          </Detail>
        ) : null}
      </dl>

      {family ? (
        <ol
          aria-label="Visit order"
          className="flex flex-col divide-y divide-(color:--border-subtle) rounded-(--control-radius) border border-subtle"
        >
          {members.map((member) => (
            <li key={member.name} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2">
                <Icon name="user" size="sm" className="text-muted" />
                <span className="truncate font-semibold">{member.name}</span>
                {member.type && member.type !== type ? (
                  <span className="text-caption text-muted">{typeMeta[member.type].label}</span>
                ) : null}
              </span>
              <span className={cn("shrink-0 text-body-sm tabular-nums text-secondary", cancelled && "line-through")}>
                {member.time}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {hasActions ? (
        <div className="flex flex-wrap gap-2">
          {onAddToCalendar ? (
            <Button variant="secondary" iconStart="calendar-plus" onClick={onAddToCalendar}>
              Add to calendar
            </Button>
          ) : null}
          {onReschedule ? (
            <Button variant="ghost" onClick={onReschedule}>
              Reschedule
            </Button>
          ) : null}
          {onCancel ? (
            <Button variant="ghost" onClick={onCancel}>
              Cancel visit
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function Detail({ icon, term, children }: { icon: IconName; term: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon name={icon} size="sm" className="mt-0.5 text-muted" />
      <dt className="sr-only">{term}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
