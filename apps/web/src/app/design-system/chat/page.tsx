import { MessageBubble } from "@/components/chat/MessageBubble";
import { DateDivider } from "@/components/chat/MessageList";
import { QuickReplies } from "@/components/chat/QuickReplies";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { Note, PageHeader, Section, Stage } from "../_kit/Doc";
import {
  AppointmentStates,
  ComposerDemo,
  ComposerStates,
  ConversationDemo,
  DevicePreview,
  EmergencyDemo,
  FailedMessageDemo,
  FamilyDemo,
  HeaderDemo,
  NoticesDemo,
  QuickRepliesDemo,
  SlotPickerLiveDemo,
  SlotPickerStates,
} from "./_demos";
import { greetingReplies } from "./_data";

const dir = "src/components/chat";

export default function Page() {
  return (
    <div className="flex flex-col gap-16">
      <PageHeader title="Chat">
        The patient-facing conversation, built from presentational pieces: props in, callbacks out, no data fetching.
        Every demo below uses the real components, so what you see here is what patients see.
      </PageHeader>

      <Section
        id="conversation"
        title="Full conversation"
        description="A new patient shares their details, turns down the first set of times, gets a vague date resolved and books. Below it, a family booked back to back and an emergency handed to staff. Type in the first composer to see a live send and typing indicator. Switch the preview to judge the same conversation on a phone or a desktop."
      >
        <DevicePreview>
          <Stage title="New patient, first booking" source={`${dir}/*`} schemes="current" padded={false} className="py-8 sm:px-6">
            <ConversationDemo />
          </Stage>
          <div className="grid gap-6 2xl:grid-cols-2">
            <Stage title="Family, back to back" schemes="current" padded={false} className="py-8 sm:px-6">
              <FamilyDemo />
            </Stage>
            <Stage title="Emergency" schemes="current" padded={false} className="py-8 sm:px-6">
              <EmergencyDemo />
            </Stage>
          </div>
        </DevicePreview>
        <Note title="Why the conversation looks this way">
          The assistant restates what it understood (&quot;by early next week I&apos;m reading Monday to
          Wednesday&quot;) before offering times, so a wrong guess is caught in one turn. Every set of times can be
          turned down, and the chips are shortcuts: typing always works too.
        </Note>
      </Section>

      <Section
        id="bubbles"
        title="Message bubbles"
        description="Three senders. Consecutive messages from one sender form a run: tighter spacing inside it, a wider gap between runs, the tooth mark and timestamp only on the last bubble, and the corner nearest the speaker tightened into a tail."
      >
        <Stage title="Runs and senders" source={`${dir}/MessageBubble.tsx`}>
          <div className="flex flex-col">
            <DateDivider>Today</DateDivider>
            <MessageBubble sender="assistant" position="first" animate={false}>
              Good morning. Is this for a cleaning, a checkup or something that hurts?
            </MessageBubble>
            <MessageBubble sender="assistant" position="middle" animate={false}>
              If you are not sure, just describe it.
            </MessageBubble>
            <MessageBubble sender="assistant" position="last" timestamp="9:01 AM" animate={false}>
              I can also answer questions about insurance.
            </MessageBubble>
            <MessageBubble sender="patient" position="first" animate={false}>
              A checkup please
            </MessageBubble>
            <MessageBubble sender="patient" position="last" timestamp="9:02 AM" animate={false}>
              It&apos;s been about two years
            </MessageBubble>
            <MessageBubble sender="system" animate={false}>
              Dana from the front desk joined the conversation
            </MessageBubble>
          </div>
        </Stage>
        <Stage title="Delivery status and rich content" schemes="current">
          <div className="flex flex-col">
            <MessageBubble sender="patient" status="sending" animate={false}>
              Is there parking nearby?
            </MessageBubble>
            <FailedMessageDemo />
            <MessageBubble
              sender="assistant"
              timestamp="9:13 AM"
              animate={false}
              attachment={<QuickReplies options={greetingReplies.slice(0, 3)} />}
            >
              Yes, there&apos;s free parking behind the building on Oak Street. Anything else?
            </MessageBubble>
          </div>
        </Stage>
        <Note title="Usage">
          Pass position from the thread (compare each message&apos;s sender with its neighbours). Set
          animate to false when rendering history so only new messages rise in. Retry is a real button with a
          44px target, and &quot;Not sent&quot; is said in words next to the icon.
        </Note>
      </Section>

      <Section
        id="typing"
        title="Typing indicator"
        description="Shown while a reply is being written. Screen readers hear “Smile Desk is typing”; with reduced motion the dots hold still and a visible word replaces the animation."
      >
        <Stage source={`${dir}/TypingIndicator.tsx`}>
          <TypingIndicator />
        </Stage>
      </Section>

      <Section
        id="quick-replies"
        title="Quick replies"
        description="Suggested answers as chips. One tap answers; the group locks and the chosen chip keeps a check mark so the history stays readable. Chips wrap on narrow screens and are 44px tall."
      >
        <Stage title="Live" source={`${dir}/QuickReplies.tsx`} schemes="current">
          <QuickRepliesDemo />
        </Stage>
        <Stage title="Picked (history) and locked while the assistant replies">
          <div className="flex flex-col gap-4">
            <QuickReplies options={greetingReplies.slice(0, 3)} defaultValue="new" />
            <QuickReplies options={greetingReplies.slice(0, 3)} disabled />
          </div>
        </Stage>
      </Section>

      <Section
        id="slots"
        title="Slot picker"
        description="Open times grouped by day, as one radio group: arrow keys move between times. Taken slots stay in place, struck through and labelled “Taken”, so the day’s shape is clear without relying on color. “None of these work” is always there."
      >
        <Stage title="Live" source={`${dir}/SlotPicker.tsx`} schemes="current">
          <div className="max-w-md">
            <SlotPickerLiveDemo />
          </div>
        </Stage>
        <Stage title="States" schemes="current">
          <SlotPickerStates />
        </Stage>
        <Note title="Times that don't work">
          onNoneWork hands the turn back to the assistant, which asks what would work (&quot;after school&quot;,
          &quot;later next week&quot;) and searches again. It is a secondary button, never a link hidden below the fold.
        </Note>
      </Section>

      <Section
        id="appointment"
        title="Appointment card"
        description="The booking summary: type, who, when, how long, where, status and what can still be done. Status is a badge with an icon and a word. A cancelled card fades back, strikes its time and says so in a sentence."
      >
        <Stage source={`${dir}/AppointmentCard.tsx`} schemes="current">
          <AppointmentStates />
        </Stage>
      </Section>

      <Section
        id="emergency"
        title="Emergency & staff notices"
        description="The emergency notice confirms staff were told and when, plays back what was reported, and gives the office number and the 911 guidance. The staff notice marks a handoff to a person."
      >
        <Stage source={`${dir}/EmergencyNotice.tsx · StaffNotice.tsx`}>
          <NoticesDemo />
        </Stage>
        <Note title="Tone">
          Danger-toned but calm: no capitals, no exclamation marks, the reassurance first and the 911 line last. The
          summary is shown back so the patient can correct it.
        </Note>
      </Section>

      <Section
        id="composer"
        title="Composer"
        description="Grows with the message up to six lines. Enter sends, Shift+Enter adds a line, and Enter that confirms an input-method candidate never sends. Send stays disabled while empty or while the assistant is replying."
      >
        <Stage title="Live" source={`${dir}/Composer.tsx`} schemes="current">
          <div className="max-w-xl">
            <ComposerDemo />
          </div>
        </Stage>
        <Stage title="States">
          <ComposerStates />
        </Stage>
      </Section>

      <Section
        id="header"
        title="Chat header"
        description="Who the patient is talking to, for which practice, how quickly they answer and today's hours, plus an always-visible way to reach a person. Preference controls can sit in its slot."
      >
        <Stage source={`${dir}/ChatHeader.tsx`} schemes="current">
          <HeaderDemo />
        </Stage>
      </Section>
    </div>
  );
}
