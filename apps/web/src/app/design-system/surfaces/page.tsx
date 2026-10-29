import { Alert } from "@/components/ui/Alert";
import { Avatar, type AvatarKind, type AvatarSize } from "@/components/ui/Avatar";
import { Badge, tones, type BadgeVariant, type Tone } from "@/components/ui/Badge";
import { Card, CardBody, CardFooter, CardHeader, InteractiveCard } from "@/components/ui/Card";
import { Icon } from "@/components/icons/Icon";
import { Note, PageHeader, Section, Stage, StateGrid } from "../_kit/Doc";
import {
  CancelDialogDemo,
  DismissibleAlertDemo,
  InfoDialogDemo,
  InsuranceAlertActions,
  ToastDemo,
  VisitCardActions,
} from "./_demos";

const badgeVariants = ["soft", "outline", "solid"] as const;

export default function Page() {
  return (
    <div className="flex flex-col gap-16">
      <PageHeader title="Surfaces & feedback">
        The containers that hold content and the ways the assistant tells a patient something happened: inline alerts
        in the flow, toasts for quiet confirmations, and dialogs for the few decisions that deserve a pause.
      </PageHeader>

      {/* ---------------------------------------------------------------- Card */}
      <Section
        id="card"
        title="Card"
        description="A resting surface with an optional header (title, description, action), body and footer. Padding comes in sm, md and lg; the card owns only the frame and the vertical rhythm."
      >
        <Stage title="Composed card" source="src/components/ui/Card.tsx">
          <Card className="max-w-md">
            <CardHeader
              title="Your next visit"
              description="Cleaning with Dr. Patel"
              action={<Badge tone="success" icon="check">Confirmed</Badge>}
            />
            <CardBody>
              <p className="flex items-center gap-2 text-body-sm text-secondary">
                <Icon name="calendar" size="sm" /> Tue, Nov 4 at 9:30 AM
              </p>
              <p className="flex items-center gap-2 text-body-sm text-secondary">
                <Icon name="map-pin" size="sm" /> 214 Harbor Street, Suite 3
              </p>
            </CardBody>
            <CardFooter>
              <VisitCardActions />
            </CardFooter>
          </Card>
        </Stage>

        <Stage title="Padding sizes">
          <div className="flex flex-wrap items-start gap-4">
            {(["sm", "md", "lg"] as const).map((padding) => (
              <Card key={padding} padding={padding} className="w-48">
                <p className="text-label font-semibold">padding=&quot;{padding}&quot;</p>
              </Card>
            ))}
          </div>
        </Stage>

        <Stage
          title="Interactive card"
          description="The whole card is one target: a link when given href, a button otherwise. Each state is frozen below with data-state; the live cards in the last column respond to pointer and keyboard."
        >
          <StateGrid<{ "data-state"?: string; disabled?: boolean }>
            rows={[{ label: "Button form", props: {} }]}
            columns={[
              { label: "Rest", props: {} },
              { label: "Hover", props: { "data-state": "hover" } },
              { label: "Focus", props: { "data-state": "focus" } },
              { label: "Pressed", props: { "data-state": "active" } },
              { label: "Disabled", props: { disabled: true } },
            ]}
            render={(props) => (
              <InteractiveCard padding="sm" className="w-52" data-state={props["data-state"]} disabled={props.disabled}>
                <span className="block text-label font-semibold">Cleaning</span>
                <span className="block text-body-sm text-secondary">About 45 minutes</span>
              </InteractiveCard>
            )}
          />
          <div className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2">
            <InteractiveCard href="#card" padding="sm">
              <span className="flex items-center gap-2 text-label font-semibold">
                <Icon name="users" size="sm" /> Book for the family
              </span>
              <span className="text-body-sm text-secondary">Back-to-back visits, one trip</span>
            </InteractiveCard>
            <InteractiveCard padding="sm">
              <span className="flex items-center gap-2 text-label font-semibold">
                <Icon name="siren" size="sm" /> It&apos;s urgent
              </span>
              <span className="text-body-sm text-secondary">Pain, swelling or a broken tooth</span>
            </InteractiveCard>
          </div>
        </Stage>
        <Note title="Phrasing content only in the button form">
          A button may only contain phrasing content, so build the button form from spans. The link form takes
          anything, including CardHeader with its heading.
        </Note>
      </Section>

      {/* --------------------------------------------------------------- Badge */}
      <Section
        id="badge"
        title="Badge"
        description="A short status or category label. Seven tones across three variants; data-tone retargets the --tone-* tokens so one set of classes serves every intent."
      >
        <Stage title="Tones × variants" source="src/components/ui/Badge.tsx">
          <StateGrid<{ tone: Tone; variant: BadgeVariant }>
            rows={badgeVariants.map((variant) => ({ label: variant, props: { variant } }))}
            columns={tones.map((tone) => ({ label: tone, props: { tone } }))}
            render={(props) => (
              <Badge tone={props.tone} variant={props.variant}>
                {props.tone}
              </Badge>
            )}
          />
        </Stage>
        <Stage title="In use">
          <div className="flex flex-wrap gap-2">
            <Badge tone="success" icon="check">
              Confirmed
            </Badge>
            <Badge tone="warning" icon="clock">
              Awaiting insurance
            </Badge>
            <Badge tone="danger" icon="siren" variant="solid">
              Emergency
            </Badge>
            <Badge tone="accent" icon="users">
              Family booking
            </Badge>
            <Badge tone="brand" variant="outline">
              New patient
            </Badge>
            <Badge tone="neutral" icon="calendar-x">
              Cancelled
            </Badge>
          </div>
        </Stage>
        <Note title="Never color alone">
          Every badge says its status in words, and adds an icon where it helps. A colored dot with no text is not a
          status.
        </Note>
      </Section>

      {/* --------------------------------------------------------------- Alert */}
      <Section
        id="alert"
        title="Alert"
        description={
          <>
            An inline message in the flow of the page or conversation. Each tone has its own icon. Danger alerts use
            role=&quot;alert&quot; and interrupt a screen reader; every other tone is a polite role=&quot;status&quot;
            (pass <code>urgent</code> to change that).
          </>
        }
      >
        <Stage title="Tones" source="src/components/ui/Alert.tsx">
          <div className="flex flex-col gap-3">
            <Alert
              tone="info"
              title="We accept all major dental insurance"
              description="Delta Dental, Cigna, MetLife, Aetna, Guardian and more. Bring your card to your first visit."
            />
            <Alert
              tone="success"
              title="We've let the front desk know"
              description="They have your summary of the chipped tooth and will call you within 15 minutes."
            />
            <Alert
              tone="warning"
              title="We couldn't confirm your insurance"
              description="You can still book. The front desk will check your plan before your visit."
              actions={<InsuranceAlertActions />}
            />
            <Alert
              tone="danger"
              icon="siren"
              title="If you have heavy bleeding or trouble breathing, call 911"
              description="For other dental emergencies, tell me what happened and I'll get you seen today."
            />
            <Alert tone="neutral" title="Open Monday to Saturday, 8 AM to 6 PM" />
            <Alert tone="brand" title="New here?" description="Registration takes about two minutes." />
          </div>
        </Stage>
        <Stage title="Dismissible" schemes="current">
          <DismissibleAlertDemo />
        </Stage>
      </Section>

      {/* -------------------------------------------------------------- Avatar */}
      <Section
        id="avatar"
        title="Avatar"
        description="Who is speaking: the assistant (tooth), a patient (initials, or a person glyph without a name) or front-desk staff (headset). Decorative by default because the speaker is named next to it; pass label when it stands alone."
      >
        <Stage title="Kinds × sizes" source="src/components/ui/Avatar.tsx">
          <StateGrid<{ kind: AvatarKind; name?: string; size: AvatarSize }>
            rows={[
              { label: "assistant", props: { kind: "assistant" } },
              { label: "patient", props: { kind: "patient" as const, name: "Maria Lopez" } },
              { label: "patient, no name", props: { kind: "patient" } },
              { label: "staff", props: { kind: "staff" } },
            ]}
            columns={[
              { label: "sm", props: { size: "sm" } },
              { label: "md", props: { size: "md" } },
              { label: "lg", props: { size: "lg" } },
            ]}
            render={(props) => <Avatar kind={props.kind ?? "assistant"} name={props.name} size={props.size} />}
          />
        </Stage>
        <Stage title="With a name">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Avatar kind="assistant" />
              <div>
                <p className="text-label font-semibold">Smile Desk assistant</p>
                <p className="text-caption text-muted">Usually replies right away</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Avatar kind="staff" />
              <div>
                <p className="text-label font-semibold">Front desk</p>
                <p className="text-caption text-muted">Joined the conversation</p>
              </div>
            </div>
          </div>
        </Stage>
      </Section>

      {/* -------------------------------------------------------------- Dialog */}
      <Section
        id="dialog"
        title="Dialog"
        description="Built on the native <dialog> and showModal(): the browser supplies the focus trap, Esc, the inert background and the top layer. Focus returns to the trigger on close. The scrim is ::backdrop painted with --dialog-scrim."
      >
        <Stage
          title="Destructive confirmation"
          source="src/components/ui/Dialog.tsx"
          schemes="current"
          description='tone="danger" turns the icon and focus ring red. The safe choice carries data-autofocus so it takes focus first, and the danger button says exactly what it does.'
        >
          <CancelDialogDemo />
        </Stage>
        <Stage title="Informational" schemes="current">
          <InfoDialogDemo />
        </Stage>
        <Note title="When to use a dialog">
          Only for a decision that cannot be undone or needs the patient&apos;s full attention. Information belongs in
          the conversation or an Alert; a confirmation that already happened belongs in a Toast.
        </Note>
      </Section>

      {/* --------------------------------------------------------------- Toast */}
      <Section
        id="toast"
        title="Toast"
        description="A quiet confirmation at the bottom of the screen. ToastProvider renders one polite live region from first paint; useToast().toast() adds to it. Toasts leave after six seconds, pause while hovered or focused, and stack up to three."
      >
        <Stage title="Try each tone" source="src/components/ui/Toast.tsx" schemes="current">
          <ToastDemo />
        </Stage>
        <Note title="Toasts confirm, they never ask">
          A toast can vanish before someone reads it, so it never holds the only copy of important information and
          never asks for a decision. The booking also appears in the conversation; the toast just echoes it.
        </Note>
        <Note title="Layering">
          The toast region sits at --z-toast. An open dialog lives in the browser&apos;s top layer, above every
          z-index, so a toast fired from inside a dialog appears once the dialog closes.
        </Note>
      </Section>
    </div>
  );
}
