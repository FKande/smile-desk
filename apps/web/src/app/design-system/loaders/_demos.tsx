"use client";

import { useState } from "react";
import { ProgressBar } from "@/components/feedback/ProgressBar";
import { Skeleton } from "@/components/feedback/Skeleton";
import { Button } from "@/components/ui/Button";

/* Interactive demos for /design-system/loaders. Real components; only the
 * surrounding state lives here. */

/* Button handles its own click, so it renders from a client component. */
export function LoadingButtonDemo() {
  return <Button loading>Booking…</Button>;
}

const slots = ["8:30 AM", "9:30 AM", "11:00 AM", "1:15 PM", "3:45 PM", "5:00 PM"];

/** The slot list as it loads, and as it lands. aria-busy sits on the list
 *  container; the skeleton blocks themselves are hidden from assistive tech. */
export function SlotListDemo() {
  const [loading, setLoading] = useState(true);
  return (
    <div className="flex flex-col gap-4">
      <div aria-busy={loading} aria-live="polite" className="flex max-w-md flex-col gap-3">
        <p className="text-label font-semibold">Thursday, Nov 6</p>
        {loading ? (
          <>
            <span className="sr-only">Loading available times</span>
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => (
                <Skeleton key={slot} radius="md" className="h-(--control-h-md)" />
              ))}
            </div>
          </>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {slots.map((slot) => (
              <li
                key={slot}
                className="flex h-(--control-h-md) animate-fade-in items-center justify-center rounded-md border border-(color:--slot-border) bg-(--slot-bg) text-label font-semibold text-(color:--slot-fg)"
              >
                {slot}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button variant="secondary" size="sm" onClick={() => setLoading((v) => !v)}>
        {loading ? "Show loaded times" : "Show loading state"}
      </Button>
    </div>
  );
}

const steps = ["Your details", "Insurance", "Pick a time", "Confirm"];

export function StepProgressDemo() {
  const [step, setStep] = useState(2);
  return (
    <div className="flex max-w-md flex-col gap-4">
      <ProgressBar
        label={steps[step - 1]}
        value={step}
        max={steps.length}
        valueText={`Step ${step} of ${steps.length}`}
        showValue
      />
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        <Button size="sm" disabled={step === steps.length} onClick={() => setStep((s) => s + 1)}>
          Next step
        </Button>
      </div>
    </div>
  );
}
