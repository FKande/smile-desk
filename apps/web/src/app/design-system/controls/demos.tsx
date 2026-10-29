"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { buttonSizes, buttonVariants } from "@/components/ui/button-styles";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { StateGrid } from "../_kit/Doc";

/* Interactive demos only: anything needing state or a render prop lives here,
 * so the catalog page itself stays a server component. Button and IconButton
 * render here too: they attach event handlers but are not client modules,
 * so a server component cannot render them directly. */

/** The low-level API: Field hands its wired ids to any control. */
export function FieldRenderPropDemo() {
  const [phone, setPhone] = useState("");
  const tooShort = phone.length > 0 && phone.replace(/\D/g, "").length < 10;
  return (
    <Field
      label="Phone number"
      description="We'll text your appointment reminders here."
      error={tooShort ? "That looks a little short. Please include the area code." : undefined}
      required
      className="max-w-sm"
    >
      {(control) => (
        <Input
          {...control}
          type="tel"
          icon="phone"
          autoComplete="tel"
          inputMode="tel"
          placeholder="(555) 123-4567"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      )}
    </Field>
  );
}

const family = ["Maya (me)", "Daniel", "Leo, age 7"] as const;

/** Parent "select all" with a mixed state, as used for family bookings. */
export function FamilyCheckboxDemo() {
  const [selected, setSelected] = useState<string[]>(["Maya (me)"]);
  const all = selected.length === family.length;
  const some = selected.length > 0 && !all;
  return (
    <fieldset className="flex flex-col">
      <legend className="pb-1 text-label font-semibold">Who is coming in?</legend>
      <Checkbox
        label="Everyone"
        checked={all}
        indeterminate={some}
        onChange={() => setSelected(all ? [] : [...family])}
      />
      <div className="flex flex-col pl-8">
        {family.map((name) => (
          <Checkbox
            key={name}
            label={name}
            checked={selected.includes(name)}
            onChange={(event) =>
              setSelected((current) =>
                event.target.checked ? [...current, name] : current.filter((item) => item !== name),
              )
            }
          />
        ))}
      </div>
    </fieldset>
  );
}

export function SwitchDemo() {
  const [reminders, setReminders] = useState(true);
  return (
    <div className="flex max-w-md flex-col">
      <Switch
        label="Text me reminders"
        description={reminders ? "On: we'll text you the day before." : "Off: we won't send texts."}
        checked={reminders}
        onCheckedChange={setReminders}
      />
      <Switch label="Back-to-back for my family" description="Book everyone one after another." defaultChecked />
    </div>
  );
}

type Visit = "cleaning" | "checkup" | "emergency";

export function SegmentedDemo() {
  const [visit, setVisit] = useState<Visit>("cleaning");
  return (
    <div className="flex flex-col items-start gap-3">
      <SegmentedControl
        legend="Type of visit"
        value={visit}
        onChange={setVisit}
        options={[
          { value: "cleaning", label: "Cleaning", icon: "tooth" },
          { value: "checkup", label: "Checkup", icon: "calendar" },
          { value: "emergency", label: "Emergency", icon: "siren" },
        ]}
      />
      <p className="text-body-sm text-secondary" aria-live="polite">
        Selected: {visit === "checkup" ? "General checkup" : visit === "cleaning" ? "Cleaning" : "Emergency"}
      </p>
    </div>
  );
}

/* Forced states: data-state freezes the look (see the state variants in
 * styles/theme.css). Disabled also sets the real attribute. */
const states: { label: string; props: Partial<ButtonProps> }[] = [
  { label: "Default", props: {} },
  { label: "Hover", props: { "data-state": "hover" } as Partial<ButtonProps> },
  {
    label: "Pressed",
    props: { "data-state": "active" } as Partial<ButtonProps>,
  },
  { label: "Focus", props: { "data-state": "focus" } as Partial<ButtonProps> },
  { label: "Disabled", props: { disabled: true } },
  { label: "Loading", props: { loading: true } },
];

const variantRows = buttonVariants.map((variant) => ({
  label: variant[0].toUpperCase() + variant.slice(1),
  props: { variant },
}));

export function ButtonStateGrid() {
  return (
    <StateGrid<ButtonProps>
      rows={variantRows}
      columns={states}
      render={(props) => <Button {...props}>{props.loading ? "Booking…" : "Book visit"}</Button>}
    />
  );
}

export function ButtonSizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {buttonSizes.map((size) => (
        <Button key={size} size={size}>
          {size === "sm" ? "Small" : size === "md" ? "Medium" : "Large"}
        </Button>
      ))}
    </div>
  );
}

export function ButtonIcons() {
  return (
    <div className="flex max-w-sm flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Button iconStart="calendar-check">Confirm 9:30 am</Button>
        <Button variant="secondary" iconEnd="arrow-right">
          See more times
        </Button>
      </div>
      <Button variant="danger" iconStart="calendar-x" fullWidth>
        Cancel appointment
      </Button>
    </div>
  );
}

export function IconButtonStateGrid() {
  return (
    <StateGrid<ButtonProps>
      rows={variantRows}
      columns={states}
      render={(props) => <IconButton icon="phone" label="Call the office" {...props} />}
    />
  );
}

export function IconButtonSizes() {
  return (
    <div className="flex items-center gap-3">
      {buttonSizes.map((size) => (
        <IconButton key={size} size={size} icon="plus" label="Add a family member" variant="secondary" />
      ))}
    </div>
  );
}
