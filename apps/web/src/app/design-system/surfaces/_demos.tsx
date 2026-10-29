"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ToastProvider, useToast, type ToastTone } from "@/components/ui/Toast";

/* Interactive demos for /design-system/surfaces. They use the real
 * components; only the surrounding state lives here. */

/* Button handles its own click (to swallow it while loading), so it can only
 * render inside a client component. These small wrappers keep the static
 * demos on the server page. */
export function VisitCardActions() {
  return (
    <>
      <Button variant="ghost" size="sm">
        Cancel
      </Button>
      <Button variant="secondary" size="sm">
        Reschedule
      </Button>
    </>
  );
}

export function InsuranceAlertActions() {
  return (
    <>
      <Button size="sm" variant="secondary">
        Update insurance
      </Button>
      <Button size="sm" variant="ghost">
        See self-pay options
      </Button>
    </>
  );
}

export function DismissibleAlertDemo() {
  const [visible, setVisible] = useState(true);
  if (!visible) {
    return (
      <Button variant="secondary" size="sm" iconStart="refresh" onClick={() => setVisible(true)}>
        Show the alert again
      </Button>
    );
  }
  return (
    <Alert
      tone="info"
      title="Bring your insurance card"
      description="The front desk will scan it at check-in. It takes about a minute."
      onDismiss={() => setVisible(false)}
    />
  );
}

export function CancelDialogDemo() {
  const [open, setOpen] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  return (
    <div className="flex flex-col items-start gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" iconStart="calendar-x" onClick={() => setOpen(true)}>
          Cancel appointment
        </Button>
        {cancelled ? (
          <Button variant="ghost" size="sm" onClick={() => setCancelled(false)}>
            Reset demo
          </Button>
        ) : null}
      </div>
      <p role="status" className="text-body-sm text-secondary">
        {cancelled ? "Appointment cancelled." : "Your cleaning is on Tue, Nov 4 at 9:30 AM."}
      </p>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        tone="danger"
        title="Cancel this appointment?"
        description="Your cleaning on Tue, Nov 4 at 9:30 AM will be released for other patients. You can book a new time whenever you like."
        actions={
          <>
            <Button variant="secondary" data-autofocus onClick={() => setOpen(false)}>
              Keep appointment
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setCancelled(true);
                setOpen(false);
              }}
            >
              Yes, cancel it
            </Button>
          </>
        }
      />
    </div>
  );
}

export function InfoDialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" iconStart="credit-card" onClick={() => setOpen(true)}>
        Payment options
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        icon="credit-card"
        title="Paying without insurance"
        description="Plenty of our patients pay their own way. Here is what we offer."
        actions={
          <Button data-autofocus onClick={() => setOpen(false)}>
            Got it
          </Button>
        }
      >
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-body-sm text-default">
          <li>Self-pay pricing, quoted before any treatment.</li>
          <li>A yearly membership that covers two cleanings and checkups.</li>
          <li>Monthly financing for larger treatment plans.</li>
        </ul>
      </Dialog>
    </>
  );
}

const samples: { tone: ToastTone; label: string; title: string; description?: string }[] = [
  {
    tone: "success",
    label: "Booked",
    title: "Appointment booked for Tue, Nov 4 at 9:30 AM",
    description: "A confirmation text is on its way.",
  },
  { tone: "info", label: "Staff notified", title: "We've let the front desk know", description: "Someone will call you shortly." },
  { tone: "warning", label: "Slot taken", title: "That time was just taken", description: "Here are the next closest times." },
  { tone: "danger", label: "Not saved", title: "We couldn't save that change", description: "Please try again in a moment." },
  { tone: "neutral", label: "Neutral", title: "Reminder set for the day before" },
];

function ToastButtons() {
  const { toast } = useToast();
  return (
    <div className="flex flex-wrap gap-3">
      {samples.map(({ label, ...options }) => (
        <Button key={label} variant="secondary" size="sm" onClick={() => toast(options)}>
          {label}
        </Button>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => toast({ title: "Stays until you close it", tone: "info", duration: Infinity })}
      >
        Persistent
      </Button>
    </div>
  );
}

export function ToastDemo() {
  return (
    <ToastProvider>
      <ToastButtons />
    </ToastProvider>
  );
}
