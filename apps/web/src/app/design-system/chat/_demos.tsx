"use client";

import { createContext, use, useRef, useState, type ReactNode } from "react";
import { AppointmentCard } from "@/components/chat/AppointmentCard";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { Composer } from "@/components/chat/Composer";
import { EmergencyNotice } from "@/components/chat/EmergencyNotice";
import { DateDivider, MessageList } from "@/components/chat/MessageList";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { QuickReplies } from "@/components/chat/QuickReplies";
import { SlotPicker } from "@/components/chat/SlotPicker";
import { StaffNotice } from "@/components/chat/StaffNotice";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { TextSizeToggle, ThemeToggle } from "@/components/theme/PreferenceControls";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import { earlyNextWeek, family, familyBlocks, greetingReplies, laterInWeek, visitReplies } from "./_data";

/* Stateful demos for /design-system/chat. Everything here is assembled from
 * the real components; nothing re-creates their markup. */

const noop = () => {};

/* ---------- Device preview ---------- */

/* The conversation demos render in a phone frame or a desktop window, so the
 * same components can be judged at both sizes without resizing the browser.
 * Phone: a 25rem column. Desktop: a wide window whose header spans the full
 * width while the thread and composer sit in a centered reading column of
 * --chat-max-width, which is how the real chat screen lays out on a laptop. */
type Device = "phone" | "desktop";

const DeviceContext = createContext<Device>("phone");

const deviceOptions: SegmentedOption<Device>[] = [
  { value: "phone", label: "Phone", icon: "smartphone" },
  { value: "desktop", label: "Desktop", icon: "monitor" },
];

export function DevicePreview({ children }: { children: ReactNode }) {
  const [device, setDevice] = useState<Device>("phone");
  return (
    <DeviceContext value={device}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-label font-semibold text-secondary">Preview as</span>
        <SegmentedControl legend="Preview device" options={deviceOptions} value={device} onChange={setDevice} />
      </div>
      {children}
    </DeviceContext>
  );
}

/** A chat window: header, thread, composer, sized by the active preview device. */
function Phone({ label, children, footer }: { label: string; children: ReactNode; footer?: ReactNode }) {
  const device = use(DeviceContext);
  const desktop = device === "desktop";
  const column = desktop ? "mx-auto flex w-full max-w-(--chat-max-width) min-h-0 flex-1 flex-col" : "contents";
  return (
    <div
      aria-label={label}
      role="region"
      data-device={device}
      className={cn(
        "mx-auto flex h-[46rem] w-full flex-col overflow-hidden border border-default bg-canvas shadow-modal",
        desktop ? "max-w-5xl rounded-xl" : "max-w-[25rem] rounded-2xl",
      )}
    >
      <ChatHeader hours="Open today 8 AM – 6 PM" onTalkToPerson={noop} />
      <div className={column}>{children}</div>
      <div className="border-t border-subtle bg-surface px-3 pt-3">
        <div className={desktop ? "mx-auto w-full max-w-(--chat-max-width)" : undefined}>
          {footer ?? <Composer onSend={noop} hint="Enter to send, Shift + Enter for a new line" />}
        </div>
      </div>
    </div>
  );
}

/* ---------- 1. The full new-patient conversation ---------- */

type Extra = { id: number; text: string };

export function ConversationDemo() {
  const [extra, setExtra] = useState<Extra[]>([]);
  const [typing, setTyping] = useState(false);
  const nextId = useRef(0);

  function handleSend(text: string) {
    const id = nextId.current++;
    setExtra((list) => [...list, { id, text }]);
    setTyping(true);
    window.setTimeout(() => setTyping(false), 1800);
  }

  return (
    <Phone
      label="Sample conversation: a new patient books a cleaning"
      footer={
        <Composer onSend={handleSend} busy={typing} hint="Try typing here. Enter sends, Shift + Enter adds a line." />
      }
    >
      <MessageList scrollToEndKey={extra.length}>
        <DateDivider>Today</DateDivider>
        <MessageBubble sender="assistant" position="first" animate={false}>
          Hi, I&apos;m Maya, the assistant for Smile Desk Dental. I can book, move or cancel a visit, or answer
          questions about insurance and hours.
        </MessageBubble>
        <MessageBubble
          sender="assistant"
          position="last"
          timestamp="9:02 AM"
          animate={false}
          attachment={<QuickReplies options={greetingReplies} defaultValue="new" />}
        >
          What can I help with today?
        </MessageBubble>

        <MessageBubble sender="patient" timestamp="9:02 AM" animate={false}>
          I&apos;m a new patient
        </MessageBubble>

        <MessageBubble sender="assistant" timestamp="9:02 AM" animate={false}>
          Welcome. To set you up I need four things: your full name, phone number, date of birth, and the name of your
          insurance if you have one.
        </MessageBubble>

        <MessageBubble sender="patient" position="first" animate={false}>
          Maria Gonzalez, (555) 284-1937
        </MessageBubble>
        <MessageBubble sender="patient" position="last" timestamp="9:04 AM" animate={false}>
          Born March 12, 1986. I have Delta Dental.
        </MessageBubble>

        <MessageBubble sender="assistant" position="first" animate={false}>
          Thank you, Maria. Delta Dental is in network, so you&apos;re all set.
        </MessageBubble>
        <MessageBubble
          sender="assistant"
          position="last"
          timestamp="9:04 AM"
          animate={false}
          attachment={<QuickReplies options={visitReplies} defaultValue="cleaning" />}
        >
          What would you like to come in for?
        </MessageBubble>

        <MessageBubble sender="patient" timestamp="9:05 AM" animate={false}>
          A cleaning. Early next week if you can, mornings are best.
        </MessageBubble>

        <MessageBubble
          sender="assistant"
          timestamp="9:05 AM"
          animate={false}
          attachment={
            <SlotPicker
              legend="Mornings, Mon Nov 3 – Wed Nov 5"
              description="Cleaning · 60 min · Dr. Patel"
              days={earlyNextWeek}
              onConfirm={noop}
              onNoneWork={noop}
              disabled
            />
          }
        >
          By early next week I&apos;m reading Monday to Wednesday, Nov 3 to 5. These mornings are open:
        </MessageBubble>

        <MessageBubble sender="patient" timestamp="9:06 AM" animate={false}>
          None of these work. I do school drop-off until 9:30. Anything later in the week?
        </MessageBubble>

        <MessageBubble
          sender="assistant"
          timestamp="9:06 AM"
          animate={false}
          attachment={
            <SlotPicker
              legend="After 9:30 AM, Thu Nov 6 – Fri Nov 7"
              description="Cleaning · 60 min · Dr. Patel"
              days={laterInWeek}
              defaultValue="fri-1015"
              onConfirm={noop}
              onNoneWork={noop}
              onShowMore={noop}
            />
          }
        >
          No problem. Here is what&apos;s open after 9:30 on Thursday and Friday:
        </MessageBubble>

        <MessageBubble sender="patient" timestamp="9:07 AM" animate={false}>
          Friday at 10:15 works.
        </MessageBubble>

        <MessageBubble
          sender="assistant"
          position="first"
          animate={false}
          attachment={
            <AppointmentCard
              type="cleaning"
              status="confirmed"
              patientName="Maria Gonzalez"
              date="Friday, November 7"
              time="10:15 AM"
              duration="60 min"
              reference="BSD-4821"
              onAddToCalendar={noop}
              onReschedule={noop}
              onCancel={noop}
            />
          }
        >
          You&apos;re booked. I sent a confirmation text to (555) 284-1937.
        </MessageBubble>
        <MessageBubble sender="assistant" position="last" timestamp="9:07 AM" animate={false}>
          Please bring your Delta Dental card and arrive about 10 minutes early for new-patient paperwork. Anything else
          I can help with?
        </MessageBubble>

        {extra.map((message) => (
          <MessageBubble key={message.id} sender="patient" timestamp="Just now">
            {message.text}
          </MessageBubble>
        ))}
        {typing ? <TypingIndicator /> : null}
      </MessageList>
    </Phone>
  );
}

/* ---------- 2. Family, back to back ---------- */

export function FamilyDemo() {
  return (
    <Phone label="Sample conversation: booking a family back to back">
      <MessageList>
        <MessageBubble sender="patient" timestamp="11:20 AM" animate={false}>
          Can I book cleanings for me, my husband and our two kids? Back to back would be ideal, ideally a Saturday.
        </MessageBubble>
        <MessageBubble
          sender="assistant"
          timestamp="11:20 AM"
          animate={false}
          attachment={
            <SlotPicker
              mode="block"
              legend="Four cleanings in a row"
              description="45 min each, kids first if you prefer"
              days={familyBlocks}
              defaultValue="sat-0900"
              onConfirm={noop}
              onNoneWork={noop}
            />
          }
        >
          Of course. These openings fit four cleanings one after another:
        </MessageBubble>
        <MessageBubble
          sender="assistant"
          timestamp="11:22 AM"
          animate={false}
          attachment={
            <AppointmentCard
              type="cleaning"
              status="confirmed"
              members={family}
              date="Saturday, November 8"
              time="9:00 AM – 12:00 PM"
              duration="45 min each"
              onAddToCalendar={noop}
              onReschedule={noop}
            />
          }
        >
          All four are booked, starting with you at 9:00.
        </MessageBubble>
      </MessageList>
    </Phone>
  );
}

/* ---------- 3. Emergency ---------- */

export function EmergencyDemo() {
  return (
    <Phone label="Sample conversation: an emergency is reported">
      <MessageList>
        <MessageBubble sender="patient" timestamp="2:12 PM" animate={false}>
          My crown came off this morning and the gum around it is swollen. It really hurts when I bite.
        </MessageBubble>
        <MessageBubble
          sender="assistant"
          position="first"
          animate={false}
          attachment={
            <EmergencyNotice
              summary="Crown came off this morning (upper right). Gum swollen, pain when biting. No fever reported."
              notifiedAt="2:14 PM"
            />
          }
        >
          I&apos;m sorry, that sounds painful. I&apos;ve marked this as an emergency and let the team know.
        </MessageBubble>
        <MessageBubble
          sender="assistant"
          position="last"
          timestamp="2:14 PM"
          animate={false}
          attachment={
            <QuickReplies
              options={[
                { value: "today", label: "Yes, 3:30 PM today" },
                { value: "call", label: "Please call me instead" },
              ]}
            />
          }
        >
          We keep time open for emergencies. Could you come in today at 3:30 PM?
        </MessageBubble>
      </MessageList>
    </Phone>
  );
}

/* ---------- Component sections ---------- */

export function FailedMessageDemo() {
  const [status, setStatus] = useState<"failed" | "sending" | "sent">("failed");
  return (
    <MessageBubble
      sender="patient"
      status={status}
      timestamp="9:12 AM"
      animate={false}
      onRetry={() => {
        setStatus("sending");
        window.setTimeout(() => setStatus("sent"), 1200);
      }}
    >
      Can I bring my son to the same visit?
    </MessageBubble>
  );
}

export function QuickRepliesDemo() {
  const [picked, setPicked] = useState<string | undefined>();
  return (
    <div className="flex flex-col gap-3">
      <QuickReplies options={greetingReplies} value={picked} onSelect={setPicked} />
      <button
        type="button"
        onClick={() => setPicked(undefined)}
        className="w-fit cursor-pointer text-caption font-semibold text-link underline underline-offset-2 focused:focus-ring"
      >
        Reset demo
      </button>
    </div>
  );
}

export function SlotPickerLiveDemo() {
  const [picked, setPicked] = useState<string | undefined>();
  const [message, setMessage] = useState("Pick a time, or say none of them work.");
  return (
    <div className="flex flex-col gap-3">
      <SlotPicker
        legend="Mornings, Mon Nov 3 – Wed Nov 5"
        description="Cleaning · 60 min · Dr. Patel"
        days={earlyNextWeek}
        value={picked}
        onChange={setPicked}
        onConfirm={(id) => setMessage(`onConfirm("${id}")`)}
        onNoneWork={() => setMessage("onNoneWork(): the assistant asks what would work better.")}
        onShowMore={() => setMessage("onShowMore(): the next set of times loads.")}
      />
      <p role="status" className="font-mono text-caption text-muted">
        {message}
      </p>
    </div>
  );
}

export function SlotPickerStates() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-2">
        <span className="text-caption font-semibold text-muted">Hover, focus, selected and taken (frozen)</span>
        <SlotPicker
          legend="Choose a time"
          days={[
            {
              id: "d",
              label: "Tue, Nov 4",
              slots: [
                { id: "a", label: "8:00 AM" },
                { id: "b", label: "8:45 AM", state: "hover" },
                { id: "c", label: "9:30 AM", state: "focus" },
                { id: "d", label: "10:15 AM" },
                { id: "e", label: "11:00 AM", available: false },
              ],
            },
          ]}
          defaultValue="d"
          onNoneWork={noop}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-caption font-semibold text-muted">Loading</span>
        <SlotPicker legend="Choose a time" days={[]} loading onNoneWork={noop} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-caption font-semibold text-muted">Empty</span>
        <SlotPicker
          legend="Saturday mornings in November"
          days={[]}
          emptyMessage="Saturday mornings are full this month. Weekday evenings until 6 PM are wide open."
          onNoneWork={noop}
          onShowMore={noop}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-caption font-semibold text-muted">Family block (back to back)</span>
        <SlotPicker
          mode="block"
          legend="Four cleanings in a row"
          days={familyBlocks}
          defaultValue="sat-0900"
          onConfirm={noop}
          onNoneWork={noop}
        />
      </div>
    </div>
  );
}

export function AppointmentStates() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <AppointmentCard
        type="cleaning"
        status="confirmed"
        patientName="Maria Gonzalez"
        date="Friday, November 7"
        time="10:15 AM"
        duration="60 min"
        reference="BSD-4821"
        onAddToCalendar={noop}
        onReschedule={noop}
        onCancel={noop}
      />
      <AppointmentCard
        type="checkup"
        status="rescheduled"
        patientName="Robert Chen"
        date="Thursday, November 13"
        time="2:00 PM"
        previousTime="Tue, Nov 11 at 8:30 AM"
        duration="45 min"
        onAddToCalendar={noop}
        onReschedule={noop}
        onCancel={noop}
      />
      <AppointmentCard
        type="emergency"
        status="pending"
        patientName="Aisha Bello"
        date="Today, October 29"
        time="3:30 PM"
        duration="30 min"
        onCancel={noop}
      />
      <AppointmentCard
        type="checkup"
        status="cancelled"
        patientName="Robert Chen"
        date="Tuesday, November 11"
        time="8:30 AM"
        duration="45 min"
        onReschedule={noop}
      />
      <AppointmentCard
        className="lg:col-span-2"
        type="cleaning"
        status="confirmed"
        members={family}
        date="Saturday, November 8"
        time="9:00 AM – 12:00 PM"
        duration="45 min each"
        onAddToCalendar={noop}
        onReschedule={noop}
        onCancel={noop}
      />
    </div>
  );
}

export function NoticesDemo() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <EmergencyNotice
        summary="Chipped front tooth after a fall, sharp edge, some bleeding that has slowed."
        notifiedAt="10:41 AM"
      />
      <div className="flex flex-col gap-4">
        <StaffNotice meta="During office hours, usually within 15 minutes.">
          I&apos;ve passed your question about payment plans to our front desk. They&apos;ll call you at (555) 284-1937.
        </StaffNotice>
        <StaffNotice icon="bell" title="You're now chatting with Dana" meta="Front desk, Smile Desk Dental">
          Dana has the conversation so far, so there&apos;s no need to repeat anything.
        </StaffNotice>
      </div>
    </div>
  );
}

export function ComposerDemo() {
  const [sent, setSent] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <Composer onSend={setSent} hint="Enter to send, Shift + Enter for a new line" />
      <p role="status" className="font-mono text-caption text-muted">
        {sent === null ? "Nothing sent yet." : `onSend(${JSON.stringify(sent)})`}
      </p>
    </div>
  );
}

export function ComposerStates() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Labelled label="Empty (send disabled)">
        <Composer onSend={noop} />
      </Labelled>
      <Labelled label="Focused">
        <Composer onSend={noop} data-state="focus" defaultValue="Do you take Cigna?" />
      </Labelled>
      <Labelled label="Assistant replying (send waits)">
        <Composer onSend={noop} busy defaultValue="And what about my daughter?" />
      </Labelled>
      <Labelled label="Long message (grows to 6 lines, then scrolls)">
        <Composer
          onSend={noop}
          defaultValue={
            "Hi, a few questions.\nDo you see kids under 5?\nIs there parking?\nCan I pay part now and part later?\nDo you do whitening?\nAnd are you open the Saturday after Thanksgiving?\nThanks so much."
          }
        />
      </Labelled>
      <Labelled label="Visible label and hint">
        <Composer
          onSend={noop}
          labelVisible
          label="Your message"
          hint="Please don't share card numbers here. We'll never ask for them in chat."
        />
      </Labelled>
      <Labelled label="Disabled (conversation closed)">
        <Composer onSend={noop} disabled placeholder="This conversation has ended" />
      </Labelled>
    </div>
  );
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption font-semibold text-muted">{label}</span>
      {children}
    </div>
  );
}

export function HeaderDemo() {
  const [handoff, setHandoff] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-xl border border-subtle">
        <ChatHeader hours="Open today 8 AM – 6 PM" onTalkToPerson={() => setHandoff(true)} />
        {handoff ? (
          <div className="bg-canvas p-4">
            <StaffNotice meta="During office hours, usually within 15 minutes.">
              I&apos;ve asked the front desk to join. You can keep typing while you wait.
            </StaffNotice>
          </div>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-xl border border-subtle">
        <ChatHeader
          status="Closed now"
          available={false}
          hours="Opens Monday at 8 AM"
          onTalkToPerson={noop}
          talkToPersonLabel="Leave a message"
          controls={
            <>
              <TextSizeToggle />
              <ThemeToggle />
            </>
          }
        />
      </div>
    </div>
  );
}
