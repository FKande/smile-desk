"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Skeleton, SkeletonText } from "@/components/feedback/Skeleton";
import { Icon } from "@/components/icons/Icon";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import {
  acknowledgeNotification,
  API_URL,
  listNotifications,
  StaffApiError,
  type StaffNotification,
} from "@/lib/staff-client";
import { AlertCard } from "./AlertCard";
import { relativeTime } from "./time";

/* Polling, not a socket: one cheap indexed query per open tab every 10 s is
 * plenty for a front desk, and it survives API restarts with no reconnect
 * logic. Hidden tabs skip their turn and catch up when shown again. */
const POLL_MS = 10_000;
const CLOCK_TICK_MS = 5_000;

type Filter = "open" | "acknowledged" | "all";
const filterOptions: SegmentedOption<Filter>[] = [
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "all", label: "All" },
];

const emptyCopy: Record<Filter, { title: string; body: string }> = {
  open: {
    title: "Nothing waiting",
    body: "New emergencies, hand-offs and callbacks show up here within 10 seconds.",
  },
  acknowledged: { title: "Nothing acknowledged yet", body: "Alerts move here once someone on the team picks them up." },
  all: { title: "No alerts yet", body: "When the assistant needs the team, its alerts land here." },
};

type AlertQueueProps = {
  token: string;
  /** The API rejected the token (401): the console signs out and asks again. */
  onUnauthorized: () => void;
};

export function AlertQueue({ token, onUnauthorized }: AlertQueueProps) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("open");
  const [items, setItems] = useState<StaffNotification[] | null>(null);
  const [error, setError] = useState<StaffApiError | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(() => new Set());
  const [acking, setAcking] = useState<ReadonlySet<string>>(() => new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [now, setNow] = useState(() => Date.now());

  // Every id this tab has seen. The first load after a filter change only
  // records ids, so switching views doesn't flag old alerts as new.
  const known = useRef(new Set<string>());
  const baselined = useRef(false);
  // Only the latest request may write state, so a slow poll can't overwrite
  // a newer one (or a different filter's result).
  const requestSeq = useRef(0);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const seq = ++requestSeq.current;
      try {
        const list = await listNotifications(token, filter === "all" ? undefined : filter, signal);
        if (seq !== requestSeq.current) return;
        // The API sorts too; UTC ISO strings compare correctly as text.
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const arrivals = baselined.current ? list.filter((n) => !known.current.has(n.id)) : [];
        list.forEach((n) => known.current.add(n.id));
        baselined.current = true;

        setItems(list);
        setError(null);
        setUpdatedAt(Date.now());
        setFreshIds(new Set(arrivals.map((n) => n.id)));
        const urgent = arrivals.filter((n) => n.priority === "urgent" && n.status === "open");
        if (urgent.length === 1) setAnnouncement(`New urgent alert: ${urgent[0].summary}`);
        else if (urgent.length > 1) setAnnouncement(`${urgent.length} new urgent alerts. Newest: ${urgent[0].summary}`);
      } catch (caught) {
        if (signal?.aborted || seq !== requestSeq.current) return;
        if (caught instanceof StaffApiError && caught.status === 401) {
          onUnauthorized();
          return;
        }
        setError(caught instanceof StaffApiError ? caught : new StaffApiError(null, "Something went wrong."));
      }
    },
    [token, filter, onUnauthorized],
  );

  useEffect(() => {
    const controller = new AbortController();
    const onVisible = () => {
      if (!document.hidden) void load(controller.signal);
    };
    // The first load goes through a timer like every later one, so the
    // effect itself only subscribes and never sets state synchronously.
    const first = window.setTimeout(() => void load(controller.signal), 0);
    const poll = window.setInterval(onVisible, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearTimeout(first);
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Keeps "3 min ago" and "Updated just now" honest between polls.
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(tick);
  }, []);

  function changeFilter(next: Filter) {
    baselined.current = false;
    setFilter(next);
    setItems(null);
    setError(null);
    setFreshIds(new Set());
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  /* Optimistic: the card shows Acknowledged at once (via `acking`), and
   * falls back to open if the request fails. */
  async function acknowledge(target: StaffNotification) {
    setAcking((current) => new Set(current).add(target.id));
    try {
      const updated = await acknowledgeNotification(token, target.id);
      setItems((current) => current?.map((n) => (n.id === updated.id ? updated : n)) ?? current);
    } catch (caught) {
      if (caught instanceof StaffApiError && caught.status === 401) {
        onUnauthorized();
        return;
      }
      toast({
        tone: "danger",
        title: "Couldn't acknowledge that alert",
        description: "It's still open. Check the connection and try again.",
      });
    } finally {
      setAcking((current) => {
        const next = new Set(current);
        next.delete(target.id);
        return next;
      });
    }
  }

  const shown = items?.map((n) => (acking.has(n.id) ? { ...n, status: "acknowledged" as const } : n)) ?? null;
  const openUrgent = shown?.filter((n) => n.status === "open" && n.priority === "urgent").length ?? 0;
  const disabled = error?.status === 503;

  return (
    <section aria-labelledby="queue-heading" className="flex flex-col gap-4">
      <h2 id="queue-heading" className="sr-only">
        Alert queue
      </h2>
      {/* Mounted from the start so screen readers are already listening. */}
      <p aria-live="assertive" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl legend="Show alerts" options={filterOptions} value={filter} onChange={changeFilter} />
        <div className="flex items-center gap-1 text-caption text-secondary">
          <span>
            {updatedAt !== null
              ? `Updated ${relativeTime(new Date(updatedAt).toISOString(), now)}`
              : error
                ? "Not loaded"
                : "Loading…"}
          </span>
          <IconButton icon="refresh" label="Refresh now" size="sm" loading={refreshing} onClick={refresh} />
        </div>
      </div>

      {shown && openUrgent > 0 ? (
        <p className="flex items-center gap-2 text-label font-semibold text-danger-text">
          <Icon name="siren" size="sm" />
          {openUrgent === 1 ? "1 urgent alert needs someone now" : `${openUrgent} urgent alerts need someone now`}
        </p>
      ) : null}

      {disabled ? (
        <Alert
          tone="warning"
          title="Admin access is disabled on the server (ADMIN_TOKEN not set)."
          description="Start the API with ADMIN_TOKEN set, then try again."
          actions={
            <Button variant="secondary" size="sm" iconStart="refresh" onClick={refresh} loading={refreshing}>
              Try again
            </Button>
          }
        />
      ) : error && shown ? (
        <Alert
          tone="warning"
          urgent={false}
          title="Couldn't refresh the queue"
          description={`${error.message} Showing what was loaded ${updatedAt ? relativeTime(new Date(updatedAt).toISOString(), now) : "earlier"}; it keeps retrying every 10 seconds.`}
        />
      ) : error ? (
        <Alert
          tone="danger"
          title="Couldn't load alerts"
          description={
            error.status === null
              ? `Can't reach the API at ${API_URL}. Check that it's running.`
              : `${error.message} Try again in a moment.`
          }
          actions={
            <Button variant="secondary" size="sm" iconStart="refresh" onClick={refresh} loading={refreshing}>
              Try again
            </Button>
          }
        />
      ) : null}

      {shown === null ? (
        disabled || error ? null : <QueueSkeleton />
      ) : shown.length === 0 ? (
        <Card className="items-center py-10 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-success-subtle text-success-text">
            <Icon name="check-circle" size="lg" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-title font-semibold">{emptyCopy[filter].title}</p>
            <p className="text-body-sm text-secondary">{emptyCopy[filter].body}</p>
          </div>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((n) => (
            <li key={n.id}>
              <AlertCard notification={n} now={now} fresh={freshIds.has(n.id)} onAcknowledge={acknowledge} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QueueSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">Loading alerts</span>
      {[0, 1, 2].map((i) => (
        <Card key={i} padding="sm">
          <div className="flex gap-2">
            <Skeleton radius="full" className="h-7 w-28" />
            <Skeleton radius="full" className="h-7 w-20" />
          </div>
          <SkeletonText lines={2} />
        </Card>
      ))}
    </div>
  );
}
