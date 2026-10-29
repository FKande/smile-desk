"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Skeleton, SkeletonText } from "@/components/feedback/Skeleton";
import { Icon } from "@/components/icons/Icon";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/SegmentedControl";
import { API_URL, listFeedback, StaffApiError, type FeedbackEntry, type FeedbackRating } from "@/lib/staff-client";
import { absoluteTime, relativeTime } from "./time";
import { TranscriptDialog } from "./TranscriptDialog";

const CLOCK_TICK_MS = 5_000;

type Filter = "down" | "up" | "all";
const filterOptions: SegmentedOption<Filter>[] = [
  { value: "down", label: "Not helpful", icon: "thumbs-down" },
  { value: "up", label: "Helpful", icon: "thumbs-up" },
  { value: "all", label: "All" },
];
const ratingFor: Record<Filter, FeedbackRating | undefined> = { down: -1, up: 1, all: undefined };

const emptyCopy: Record<Filter, { title: string; body: string }> = {
  down: { title: "No complaints", body: "When a patient taps 👎 on a chat, it shows up here with their comment." },
  up: { title: "No thumbs-up yet", body: "Chats patients rated helpful show up here." },
  all: { title: "No feedback yet", body: "Patients can rate a chat 👍 or 👎 once Maya has replied." },
};

/** What patients said about their chats: the review side of the feedback loop.
 *  Defaults to 👎, the ratings worth reading first. */
export function FeedbackList() {
  const [filter, setFilter] = useState<Filter>("down");
  const [items, setItems] = useState<FeedbackEntry[] | null>(null);
  const [error, setError] = useState<StaffApiError | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewing, setViewing] = useState<FeedbackEntry | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Only the latest request may write state (a slow one can't overwrite a newer filter).
  const requestSeq = useRef(0);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const seq = ++requestSeq.current;
      try {
        const list = await listFeedback(ratingFor[filter], signal);
        if (seq !== requestSeq.current) return;
        setItems(list);
        setError(null);
        setUpdatedAt(Date.now());
      } catch (caught) {
        if (signal?.aborted || seq !== requestSeq.current) return;
        setError(caught instanceof StaffApiError ? caught : new StaffApiError(null, "Something went wrong."));
      }
    },
    [filter],
  );

  useEffect(() => {
    const controller = new AbortController();
    // Through a timer, so the effect never sets state synchronously.
    const first = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      controller.abort();
      window.clearTimeout(first);
    };
  }, [load]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(tick);
  }, []);

  function changeFilter(next: Filter) {
    setFilter(next);
    setItems(null);
    setError(null);
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <section aria-labelledby="feedback-heading" className="flex flex-col gap-4">
      <h2 id="feedback-heading" className="sr-only">
        Patient feedback
      </h2>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl legend="Show feedback" options={filterOptions} value={filter} onChange={changeFilter} />
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

      {error ? (
        <Alert
          tone={items ? "warning" : "danger"}
          urgent={items ? false : undefined}
          title={items ? "Couldn't refresh feedback" : "Couldn't load feedback"}
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

      {items === null ? (
        error ? null : <FeedbackSkeleton />
      ) : items.length === 0 ? (
        <Card className="items-center py-10 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-subtle text-secondary">
            <Icon name="message" size="lg" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-title font-semibold">{emptyCopy[filter].title}</p>
            <p className="text-body-sm text-secondary">{emptyCopy[filter].body}</p>
          </div>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((f) => (
            <li key={f.id}>
              <FeedbackCard entry={f} now={now} onView={setViewing} />
            </li>
          ))}
        </ul>
      )}

      <TranscriptDialog entry={viewing} onClose={() => setViewing(null)} />
    </section>
  );
}

function FeedbackCard({ entry: f, now, onView }: { entry: FeedbackEntry; now: number; onView: (f: FeedbackEntry) => void }) {
  const helpful = f.rating === 1;
  return (
    <Card role="article" aria-labelledby={`${f.id}-rating`} padding="sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span id={`${f.id}-rating`}>
            <Badge tone={helpful ? "success" : "danger"} icon={helpful ? "thumbs-up" : "thumbs-down"}>
              {helpful ? "Helpful" : "Not helpful"}
            </Badge>
          </span>
          <Badge tone="neutral" variant="outline" icon="user">
            {f.patientName ?? "Unverified"}
          </Badge>
        </div>
        <time dateTime={f.createdAt} title={absoluteTime(f.createdAt)} className="text-caption text-secondary">
          {relativeTime(f.createdAt, now)}
        </time>
      </div>

      {f.comment ? (
        <blockquote className="whitespace-pre-wrap break-words text-body font-semibold">“{f.comment}”</blockquote>
      ) : (
        <p className="text-body-sm text-secondary">No comment left.</p>
      )}

      {f.excerpt ? (
        <p className="break-words text-body-sm text-secondary">
          <span className="font-semibold">First message:</span> {f.excerpt}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" iconStart="message" onClick={() => onView(f)}>
          View conversation
        </Button>
      </div>
    </Card>
  );
}

function FeedbackSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">Loading feedback</span>
      {[0, 1].map((i) => (
        <Card key={i} padding="sm">
          <div className="flex gap-2">
            <Skeleton radius="full" className="h-7 w-28" />
            <Skeleton radius="full" className="h-7 w-24" />
          </div>
          <SkeletonText lines={2} />
        </Card>
      ))}
    </div>
  );
}
