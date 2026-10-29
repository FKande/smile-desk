"use client";

import { useState, useSyncExternalStore } from "react";
import { AppointmentCard } from "@/components/chat/AppointmentCard";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { Composer } from "@/components/chat/Composer";
import { EmergencyNotice } from "@/components/chat/EmergencyNotice";
import { MessageBubble, type MessagePosition } from "@/components/chat/MessageBubble";
import { MessageList } from "@/components/chat/MessageList";
import { QuickReplies, type QuickReply } from "@/components/chat/QuickReplies";
import { StaffNotice } from "@/components/chat/StaffNotice";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { Spinner } from "@/components/feedback/Spinner";
import { TextSizeToggle, ThemeToggle } from "@/components/theme/PreferenceControls";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { isMockMode, MAX_MESSAGE_LENGTH, type AppointmentSummary } from "@/lib/chat-client";
import { FeedbackPrompt } from "./FeedbackPrompt";
import {
  ASSISTANT_NAME,
  PRACTICE_HOURS,
  PRACTICE_LOCATION,
  PRACTICE_NAME,
  PRACTICE_PHONE,
  VISIT_TYPES,
} from "./practice";
import { ReplyText } from "./ReplyText";
import { timeOf, useChat, type AssistantMessage, type ChatMessage } from "./useChat";

const starters: QuickReply[] = [
  { value: "Book a cleaning", label: "Book a cleaning", icon: "sparkles" },
  { value: "I have a dental emergency", label: "I have a dental emergency", icon: "siren" },
  { value: "Reschedule my appointment", label: "Reschedule my appointment", icon: "refresh" },
  { value: "Do you take my insurance?", label: "Do you take my insurance?", icon: "credit-card" },
];

const TALK_TO_PERSON = "I'd like to talk to a person, please.";

/* Show a character count once a message gets near the API's limit. */
const COUNT_FROM = MAX_MESSAGE_LENGTH - 200;

const noSubscribe = () => () => {};

/** Run position for each message: consecutive messages from one sender stack. */
function positions(roles: ChatMessage["role"][]): MessagePosition[] {
  return roles.map((role, i) => {
    const joinsPrev = i > 0 && roles[i - 1] === role && role !== "system";
    const joinsNext = i < roles.length - 1 && roles[i + 1] === role && role !== "system";
    return joinsPrev ? (joinsNext ? "middle" : "last") : joinsNext ? "first" : "single";
  });
}

export function PatientChat() {
  const chat = useChat();
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<string>();
  const mock = useSyncExternalStore(noSubscribe, isMockMode, () => false);

  const tooLong = draft.length > MAX_MESSAGE_LENGTH;
  const replied = chat.messages.some((m) => m.role === "assistant");
  const lastPatient = chat.messages.findLast((m) => m.role === "patient");

  // The streaming bubble counts as the next assistant message for run shapes.
  const roles = chat.messages.map((m) => m.role);
  if (chat.live) roles.push("assistant");
  const runPositions = positions(roles);

  function send(text: string) {
    if (text.length > MAX_MESSAGE_LENGTH) return;
    void chat.send(text);
  }

  function startOver() {
    chat.reset();
    setPicked(undefined);
    setDraft("");
  }

  const hint = tooLong
    ? `That's ${draft.length.toLocaleString("en-US")} characters. Please keep messages under ${MAX_MESSAGE_LENGTH.toLocaleString("en-US")}.`
    : draft.length >= COUNT_FROM
      ? `${draft.length.toLocaleString("en-US")} / ${MAX_MESSAGE_LENGTH.toLocaleString("en-US")} characters`
      : "Enter to send, Shift + Enter for a new line";

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <ChatHeader
        assistantName={ASSISTANT_NAME}
        practiceName={PRACTICE_NAME}
        hours={PRACTICE_HOURS}
        onTalkToPerson={() => send(TALK_TO_PERSON)}
        controls={
          <>
            {mock ? (
              <Badge tone="warning" icon="info" className="mr-auto">
                Mock mode
              </Badge>
            ) : null}
            <Button variant="ghost" iconStart="plus" onClick={startOver}>
              New conversation
            </Button>
            <TextSizeToggle />
            <ThemeToggle />
          </>
        }
      />

      <main className="mx-auto flex min-h-0 w-full max-w-(--chat-max-width) flex-1 flex-col">
        <h1 className="sr-only">
          Chat with {ASSISTANT_NAME}, {PRACTICE_NAME}
        </h1>
        <MessageList label={`Conversation with ${ASSISTANT_NAME}`} scrollToEndKey={lastPatient?.id}>
          <Welcome
            picked={picked}
            locked={chat.busy || chat.messages.length > 0}
            onPick={(value) => {
              setPicked(value);
              send(value);
            }}
          />

          {chat.restoring ? (
            <p className="mt-4 flex items-center justify-center gap-2 text-caption text-muted">
              <Spinner size="sm" label="" />
              <span role="status">Loading your conversation</span>
            </p>
          ) : null}

          {chat.messages.map((message, i) => (
            <Message key={message.id} message={message} position={runPositions[i]} onRetry={chat.retry} />
          ))}

          {chat.live ? (
            <LiveReply text={chat.live.text} status={chat.live.status} position={runPositions.at(-1)} />
          ) : null}

          {chat.error ? (
            <Alert
              tone="danger"
              className="mt-3"
              title={chat.error.message}
              actions={
                <Button variant="secondary" iconStart="refresh" onClick={chat.retry}>
                  Try again
                </Button>
              }
            />
          ) : null}

          {replied && chat.conversationId && !chat.busy ? (
            <FeedbackPrompt key={chat.conversationId} conversationId={chat.conversationId} />
          ) : null}
        </MessageList>
      </main>

      <div className="border-t border-subtle bg-surface px-3 pt-3">
        <div className="mx-auto w-full max-w-(--chat-max-width)">
          <Composer
            value={draft}
            onValueChange={setDraft}
            onSend={send}
            busy={chat.busy || tooLong}
            label={`Message ${ASSISTANT_NAME}`}
            placeholder="Type your message"
            hint={<span className={tooLong ? "text-danger-text" : undefined}>{hint}</span>}
          />
        </div>
      </div>

      {/* Tool progress for screen readers; the streaming bubble itself is
          hidden from them so the reply is read once, when it's complete. */}
      <p role="status" className="sr-only">
        {chat.live?.status ? `${ASSISTANT_NAME} is ${chat.live.status.toLowerCase()}` : ""}
      </p>
    </div>
  );
}

function Welcome({ picked, locked, onPick }: { picked?: string; locked: boolean; onPick: (value: string) => void }) {
  return (
    <>
      <MessageBubble sender="assistant" senderName={ASSISTANT_NAME} position="first" animate={false}>
        Hi, I&apos;m {ASSISTANT_NAME}, the virtual front desk for {PRACTICE_NAME}. I can book, move or cancel a visit,
        help with an emergency, and answer questions about insurance, payment and our hours.
      </MessageBubble>
      <MessageBubble
        sender="assistant"
        senderName={ASSISTANT_NAME}
        position="last"
        animate={false}
        attachment={
          <QuickReplies options={starters} value={picked} disabled={locked} onSelect={onPick} label="Common requests" />
        }
      >
        What can I help you with today?
      </MessageBubble>
    </>
  );
}

function Message({
  message,
  position,
  onRetry,
}: {
  message: ChatMessage;
  position: MessagePosition;
  onRetry: () => void;
}) {
  if (message.role === "system") {
    return <MessageBubble sender="system">{message.text}</MessageBubble>;
  }

  const timestamp = message.at ? timeOf(message.at) : undefined;
  const dateTime = message.at?.toISOString();

  if (message.role === "patient") {
    return (
      <MessageBubble
        sender="patient"
        position={position}
        timestamp={timestamp}
        dateTime={dateTime}
        status={message.failed ? "failed" : "sent"}
        onRetry={onRetry}
        animate={Boolean(message.at)}
      >
        {message.text}
      </MessageBubble>
    );
  }

  return (
    <MessageBubble
      sender="assistant"
      senderName={ASSISTANT_NAME}
      position={position}
      timestamp={timestamp}
      dateTime={dateTime}
      animate={!message.streamed}
      attachment={<Attachments message={message} />}
    >
      {message.text ? <ReplyText text={message.text} /> : null}
    </MessageBubble>
  );
}

function Attachments({ message }: { message: AssistantMessage }) {
  const { appointments, emergency, staffNotified, degraded } = message;
  if (!appointments.length && !emergency && !staffNotified && !degraded) return null;
  return (
    <div className="flex flex-col gap-3">
      {degraded ? (
        <Alert
          tone="warning"
          title={`${ASSISTANT_NAME} is having trouble right now`}
          description={
            <>
              Our team has been asked to follow up. For anything urgent, please call{" "}
              <a
                href={`tel:+1${PRACTICE_PHONE.replace(/\D/g, "")}`}
                className="font-semibold underline underline-offset-2 focused:focus-ring"
              >
                {PRACTICE_PHONE}
              </a>
              .
            </>
          }
        />
      ) : null}
      {emergency ? (
        <EmergencyNotice
          summary={emergency.summary}
          notifiedAt={emergency.notifiedAt}
          phone={PRACTICE_PHONE}
          practiceName={PRACTICE_NAME}
        />
      ) : null}
      {staffNotified ? (
        <StaffNotice title="Our team has been notified" icon="bell" meta={PRACTICE_HOURS}>
          Someone from the {PRACTICE_NAME} front desk will follow up with you.
        </StaffNotice>
      ) : null}
      {appointments.map((appointment) => (
        <Appointment key={`${appointment.appointmentId}-${appointment.action}`} appointment={appointment} />
      ))}
    </div>
  );
}

const cardStatus = { booked: "confirmed", rescheduled: "rescheduled", cancelled: "cancelled" } as const;

function Appointment({ appointment }: { appointment: AppointmentSummary }) {
  const visit = VISIT_TYPES[appointment.typeLabel] ?? VISIT_TYPES["General checkup"];
  // "Tue, Nov 4 at 9:30 AM" → date and time.
  const [date, time = ""] = appointment.label.split(" at ");
  const who = appointment.providerName
    ? `${appointment.patientName} · with ${appointment.providerName}`
    : appointment.patientName;
  return (
    <AppointmentCard
      type={visit.type}
      status={cardStatus[appointment.action] ?? "confirmed"}
      patientName={who}
      date={date}
      time={time}
      duration={visit.duration}
      location={PRACTICE_LOCATION}
    />
  );
}

function LiveReply({ text, status, position }: { text: string; status: string | null; position?: MessagePosition }) {
  const statusLine = status ? (
    <p aria-hidden="true" className="flex items-center gap-2 px-1 text-caption text-muted">
      <Spinner size="sm" label="" />
      {status}…
    </p>
  ) : null;

  if (!text) {
    return (
      <div>
        <TypingIndicator name={ASSISTANT_NAME} />
        {statusLine ? <div className="mt-2 pl-10">{statusLine}</div> : null}
      </div>
    );
  }
  return (
    <MessageBubble
      sender="assistant"
      senderName={ASSISTANT_NAME}
      position={position}
      animate={false}
      aria-hidden="true"
      attachment={statusLine}
    >
      <ReplyText text={text} />
    </MessageBubble>
  );
}
