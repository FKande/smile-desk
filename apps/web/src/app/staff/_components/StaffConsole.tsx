"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/Icon";
import { ThemeToggle } from "@/components/theme/PreferenceControls";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/SegmentedControl";
import { AlertQueue } from "./AlertQueue";
import { FeedbackList } from "./FeedbackList";

type View = "alerts" | "feedback";
const viewOptions: SegmentedOption<View>[] = [
  { value: "alerts", label: "Alerts", icon: "bell" },
  { value: "feedback", label: "Feedback", icon: "message" },
];

/** The page shell: header, a view switch, then the alert queue or patient
 *  feedback. Both stay mounted, so the queue keeps polling (and keeps its
 *  filter and "New" marks) while someone reads feedback. */
export function StaffConsole() {
  const [view, setView] = useState<View>("alerts");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-(--gutter) py-8 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-solid text-on-brand">
            <Icon name="bell" size="lg" />
          </span>
          <div className="flex min-w-0 flex-col">
            <h1 className="text-heading font-bold">Staff</h1>
            <p className="text-body-sm text-secondary">Alerts from the assistant, and what patients said about it</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <SegmentedControl legend="Staff view" options={viewOptions} value={view} onChange={setView} className="self-start" />

      <div hidden={view !== "alerts"}>
        <AlertQueue />
      </div>
      <div hidden={view !== "feedback"}>
        <FeedbackList />
      </div>
    </main>
  );
}
