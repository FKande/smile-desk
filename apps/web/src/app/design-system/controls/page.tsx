import { Checkbox } from "@/components/ui/Checkbox";
import { TextField } from "@/components/ui/Input";
import { SelectField } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { TextareaField } from "@/components/ui/Textarea";
import { Note, PageHeader, Section, Stage } from "../_kit/Doc";
import {
  ButtonIcons,
  ButtonSizes,
  ButtonStateGrid,
  FamilyCheckboxDemo,
  FieldRenderPropDemo,
  IconButtonSizes,
  IconButtonStateGrid,
  SegmentedDemo,
  SwitchDemo,
} from "./demos";

const insurers = ["Delta Dental", "Cigna", "Aetna", "MetLife", "Guardian", "UnitedHealthcare"];

function InsuranceOptions() {
  return (
    <>
      {insurers.map((name) => (
        <option key={name}>{name}</option>
      ))}
      <option value="none">I don&apos;t have dental insurance</option>
    </>
  );
}

export default function Page() {
  return (
    <div className="flex flex-col gap-16">
      <PageHeader title="Controls">
        Everything a patient taps or types. Each control is native HTML underneath, at least 44px tall, and shows every
        state with more than color: hover and focus change shape or add a ring, errors add an icon and words.
      </PageHeader>

      <Section
        id="button"
        title="Button"
        description="Primary for the one next step (Book, Confirm). Secondary for alternatives, ghost for low-stakes actions, danger only for cancelling an appointment."
      >
        <Stage title="Variants × states" source="components/ui/Button.tsx" schemes="current">
          <ButtonStateGrid />
        </Stage>
        <Stage title="Sizes">
          <ButtonSizes />
        </Stage>
        <Stage title="With icons, full width">
          <ButtonIcons />
        </Stage>
        <Note title="Loading keeps the label meaningful">
          Change the words while busy (&ldquo;Booking…&rdquo;). The button stays focusable and in color so the patient
          can still read what is happening.
        </Note>
      </Section>

      <Section
        id="icon-button"
        title="IconButton"
        description="A single icon with a required label, which becomes the accessible name and the tooltip."
      >
        <Stage title="Variants × states" source="components/ui/IconButton.tsx" schemes="current">
          <IconButtonStateGrid />
        </Stage>
        <Stage title="Sizes">
          <IconButtonSizes />
        </Stage>
      </Section>

      <Section
        id="field"
        title="Field & Input"
        description="Field owns the label, hint and error and wires their ids to the control (id, aria-describedby, aria-invalid, aria-required). TextField is Field + Input in one tag."
      >
        <Stage title="Field states" source="components/ui/Field.tsx · components/ui/Input.tsx">
          <div className="grid gap-6 sm:grid-cols-2">
            <TextField label="Full name" autoComplete="name" placeholder="As it appears on your insurance card" />
            <TextField label="Date of birth" type="date" description="Helps us find your records." required />
            <TextField
              label="Phone number"
              type="tel"
              icon="phone"
              defaultValue="555 01"
              error="That looks a little short. Please include the area code."
              required
            />
            <TextField label="Email" type="email" placeholder="you@example.com" disabled />
            <TextField
              label="Patient ID"
              defaultValue="SD-20418"
              readOnly
              description="Read-only: shown for reference."
            />
            <TextField label="Preferred day" size="lg" icon="calendar" placeholder="Later next week" />
          </div>
        </Stage>
        <Stage title="Forced input states" schemes="current">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TextField label="Hover" placeholder="Insurance member ID" data-state="hover" />
            <TextField label="Focus" placeholder="Insurance member ID" data-state="focus" />
            <TextField label="Invalid + focus" defaultValue="12" invalid data-state="focus" />
            <TextField label="Disabled" defaultValue="Delta Dental" data-state="disabled" disabled />
          </div>
        </Stage>
        <Stage title="Render-prop API (live validation)" schemes="current">
          <FieldRenderPropDemo />
        </Stage>
        <Note title="Required is said in words">
          Fields show &ldquo;Required&rdquo; rather than an asterisk, and native <code>required</code> is left off so
          browser pop-ups never compete with our own messages. Errors say what to do next, kindly.
        </Note>
      </Section>

      <Section
        id="textarea"
        title="Textarea"
        description="Same visual language as Input. autoGrow uses CSS field-sizing so the box grows with the text, then scrolls."
      >
        <Stage source="components/ui/Textarea.tsx">
          <div className="grid gap-6 sm:grid-cols-2">
            <TextareaField
              label="What's happening?"
              description="For emergencies: where it hurts, since when, any swelling or bleeding."
              placeholder="My lower left tooth has ached since last night…"
              autoGrow
              rows={2}
            />
            <TextareaField label="Anything else we should know?" error="Please keep it under 500 characters." />
            <TextareaField label="Notes from your last visit" defaultValue="Cleaning, no concerns." readOnly rows={2} />
            <TextareaField label="Message to staff" disabled rows={2} />
          </div>
        </Stage>
      </Section>

      <Section
        id="select"
        title="Select"
        description="A styled native <select>: keyboard, screen readers and the phone's own picker work out of the box."
      >
        <Stage source="components/ui/Select.tsx">
          <div className="grid gap-6 sm:grid-cols-2">
            <SelectField label="Insurance provider" placeholder="Choose your provider" defaultValue="">
              <InsuranceOptions />
            </SelectField>
            <SelectField
              label="Insurance provider"
              placeholder="Choose your provider"
              defaultValue=""
              error="Please choose a provider, or pick “I don't have dental insurance”."
              required
            >
              <InsuranceOptions />
            </SelectField>
            <SelectField label="Visit type" defaultValue="Cleaning" size="lg">
              <option>Cleaning</option>
              <option>General checkup</option>
              <option>Emergency</option>
            </SelectField>
            <SelectField label="Location" defaultValue="Market St" disabled>
              <option>Market St</option>
            </SelectField>
          </div>
        </Stage>
      </Section>

      <Section
        id="checkbox"
        title="Checkbox"
        description="For choices submitted with a form. The native input is the box, so focus and keyboard behave as expected; the whole row is the tap target."
      >
        <Stage title="States" source="components/ui/Checkbox.tsx">
          <div className="grid gap-x-8 sm:grid-cols-2">
            <Checkbox label="I'm booking for someone else" />
            <Checkbox label="I'm booking for someone else" defaultChecked />
            <Checkbox label="Hover" data-state="hover" />
            <Checkbox label="Focus" data-state="focus" defaultChecked />
            <Checkbox label="Disabled" disabled />
            <Checkbox label="Disabled, checked" disabled defaultChecked />
            <Checkbox
              label="Book back-to-back"
              description="We'll look for times one after another so you make one trip."
              defaultChecked
            />
            <Checkbox
              label="I agree to the cancellation policy"
              error="Please agree to the policy to confirm your booking."
            />
          </div>
        </Stage>
        <Stage title="Mixed state (select all)" schemes="current">
          <FamilyCheckboxDemo />
        </Stage>
      </Section>

      <Section
        id="switch"
        title="Switch"
        description="For settings that apply right away. A button with role=switch: 44px hit area around a smaller track, and the label toggles it too."
      >
        <Stage title="Interactive" source="components/ui/Switch.tsx" schemes="current">
          <SwitchDemo />
        </Stage>
        <Stage title="States">
          <div className="grid max-w-2xl gap-x-8 sm:grid-cols-2">
            <Switch label="Off" />
            <Switch label="On" defaultChecked />
            <Switch label="Hover" data-state="hover" />
            <Switch label="Hover, on" data-state="hover" defaultChecked />
            <Switch label="Pressed" data-state="active" />
            <Switch label="Focus" data-state="focus" defaultChecked />
            <Switch label="Disabled" disabled />
            <Switch label="Disabled, on" disabled defaultChecked />
          </div>
        </Stage>
        <Note title="Switch or checkbox?">
          If the change happens the moment it is tapped, use a Switch. If it waits for a Confirm button, use a Checkbox.
        </Note>
      </Section>

      <Section
        id="segmented"
        title="SegmentedControl"
        description="One choice out of a few, all visible. Built on native radio inputs, so arrow keys move between options."
      >
        <Stage source="components/ui/SegmentedControl.tsx" schemes="current">
          <SegmentedDemo />
        </Stage>
      </Section>
    </div>
  );
}
