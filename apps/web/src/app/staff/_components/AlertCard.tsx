"use client";

import { useRef } from "react";
import type { IconName } from "@/components/icons/Icon";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { NotificationKind, NotificationPriority, StaffNotification } from "@/lib/staff-client";
import { absoluteTime, relativeTime } from "./time";

const kinds: Record<NotificationKind, { label: string; icon: IconName }> = {
  emergency: { label: "Emergency", icon: "siren" },
  escalation: { label: "Hand-off", icon: "headset" },
  callback: { label: "Callback", icon: "phone" },
};

/* Priority sets the card's tone; every badge also says it in words. */
const priorities: Record<NotificationPriority, { label: string; tone: Tone }> = {
  urgent: { label: "Urgent", tone: "danger" },
  high: { label: "High priority", tone: "warning" },
  normal: { label: "Normal", tone: "neutral" },
};

type AlertCardProps = {
  notification: StaffNotification;
  now: number;
  /** Arrived since the previous poll. */
  fresh: boolean;
  onAcknowledge: (notification: StaffNotification) => void;
};

export function AlertCard({ notification: n, now, fresh, onAcknowledge }: AlertCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const kind = kinds[n.kind];
  const priority = priorities[n.priority];
  const open = n.status === "open";
  // Only what still needs someone gets the loud treatment.
  const loud = open && n.priority !== "normal";
  const details = n.details ? Object.entries(n.details) : [];

  function acknowledge() {
    onAcknowledge(n);
    // The button unmounts; keep keyboard focus on this alert, not the page.
    cardRef.current?.focus();
  }

  return (
    <Card
      ref={cardRef}
      tabIndex={-1}
      data-tone={priority.tone}
      aria-labelledby={`${n.id}-summary`}
      role="article"
      padding="sm"
      className={cn(
        "outline-none focused:focus-ring",
        loud && "border-l-4 [--card-border:var(--tone-border)] border-l-(color:--tone-solid)",
        loud && n.priority === "urgent" && "[--card-bg:var(--tone-subtle)]",
        fresh && "animate-rise-in ring-2 ring-brand-border",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={priority.tone} icon={kind.icon} variant={loud ? "solid" : "soft"}>
            {kind.label}
          </Badge>
          <Badge tone={priority.tone} variant="outline">
            {priority.label}
          </Badge>
          {fresh ? (
            <Badge tone="brand" icon="sparkles">
              New
            </Badge>
          ) : null}
          {!open ? (
            <Badge tone="success" icon="check">
              Acknowledged
            </Badge>
          ) : null}
        </div>
        <time dateTime={n.createdAt} title={absoluteTime(n.createdAt)} className="text-caption text-secondary">
          {relativeTime(n.createdAt, now)}
        </time>
      </div>

      <p id={`${n.id}-summary`} className="text-body font-semibold">
        {n.summary}
      </p>

      {details.length > 0 || n.patientId || n.conversationId ? (
        <details className="group text-body-sm">
          <summary className="cursor-pointer rounded-sm text-secondary focused:focus-ring">More details</summary>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {details.map(([key, value]) => (
              <Detail key={key} term={humanize(key)} value={formatValue(value)} />
            ))}
            {n.patientId ? <Detail term="Patient" value={n.patientId} mono /> : null}
            {n.conversationId ? <Detail term="Conversation" value={n.conversationId} mono /> : null}
          </dl>
        </details>
      ) : null}

      {open ? (
        <div className="flex justify-end">
          <Button variant={n.priority === "urgent" ? "primary" : "secondary"} size="sm" iconStart="check" onClick={acknowledge}>
            Acknowledge
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function Detail({ term, value, mono }: { term: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-secondary">{term}</dt>
      <dd className={cn("min-w-0 break-words", mono && "font-mono text-caption")}>{value}</dd>
    </>
  );
}

/** "insuranceName" → "Insurance name". */
function humanize(key: string): string {
  const words = key.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
