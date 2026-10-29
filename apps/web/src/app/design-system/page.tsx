import type { ReactNode } from "react";
import { Icon, iconNames } from "@/components/icons/Icon";
import { Badge } from "@/components/ui/Badge";
import { Note, PageHeader, Section, Stage } from "./_kit/Doc";

/* Foundations: every swatch below paints with var(--token), so this page
 * always shows what the CSS actually says. Token names are listed here by
 * hand; values are never copied. */

const steps = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200] as const;
const ramps = [
  { name: "teal", role: "Brand" },
  { name: "slate", role: "Neutral" },
  { name: "coral", role: "Accent" },
  { name: "green", role: "Success" },
  { name: "amber", role: "Warning" },
  { name: "red", role: "Danger" },
  { name: "blue", role: "Info" },
] as const;

const surfaces = [
  ["--bg-canvas", "Page background behind everything"],
  ["--bg-surface", "Cards, bubbles, inputs"],
  ["--bg-surface-raised", "Dialogs and popovers"],
  ["--bg-subtle", "Wells and quiet fills inside a surface"],
  ["--bg-muted", "Elements: skeletons, tracks"],
  ["--bg-hover", "Hover fill for neutral controls"],
  ["--bg-active", "Pressed fill, switch track"],
  ["--bg-inverse", "Toasts and high-emphasis chrome"],
] as const;

const foregrounds = [
  ["--fg-default", "Body copy and headings"],
  ["--fg-secondary", "Supporting copy"],
  ["--fg-muted", "Captions, placeholders, timestamps"],
  ["--fg-disabled", "Disabled labels (exempt from contrast)"],
  ["--fg-link", "Inline links"],
] as const;

const borders = [
  ["--border-subtle", "Dividers"],
  ["--border-default", "Cards and chips"],
  ["--border-strong", "Form controls (3:1 against the surface)"],
  ["--border-hover", "Hovered controls"],
] as const;

const intents = ["brand", "accent", "success", "warning", "danger", "info"] as const;
const intentSteps = ["subtle", "element", "border", "solid", "solid-hover", "text"] as const;

const typeRoles = [
  ["text-display", "40px / 1.1", "Catalog and marketing headlines", "Gentle care, any hour"],
  ["text-heading", "26px / 1.25", "Page and screen headings", "Book your next visit"],
  ["text-title", "20px / 1.35", "Card and section titles", "Cleaning with Dr. Patel"],
  ["text-body", "17px / 1.55", "Messages and reading text", "I can see a 9:30 AM opening on Tuesday. Would that work for you?"],
  ["text-body-sm", "15px / 1.5", "Secondary copy", "We accept all major dental insurance plans."],
  ["text-label", "15px / 1.3", "Buttons, chips, field labels", "Date of birth"],
  ["text-caption", "14px / 1.4", "Timestamps and metadata: the floor", "Sent 9:41 AM"],
] as const;

const radii = ["xs", "sm", "md", "lg", "xl", "2xl", "full"] as const;
const elevations = [
  ["shadow-raised", "Resting chrome barely off the page"],
  ["shadow-card", "A resting surface that should read as lifted"],
  ["shadow-overlay", "Transient: popovers and toasts"],
  ["shadow-modal", "Takes over the screen: dialogs"],
] as const;

const durations = [
  ["--duration-fast", "120ms", "Hover, press, color and border changes"],
  ["--duration-base", "200ms", "Dialogs, toasts, message arrival"],
  ["--duration-slow", "320ms", "Larger, deliberate transitions"],
] as const;

const loops = [
  ["--duration-loop-spin", "800ms", "Spinner rotation"],
  ["--duration-loop-pulse", "1200ms", "Typing dots"],
  ["--duration-loop-sweep", "1400ms", "Indeterminate progress"],
  ["--duration-loop-shimmer", "1600ms", "Skeleton sweep"],
] as const;

const easings = [
  ["ease-out", "The everyday decelerate: hovers, fades, entrances"],
  ["ease-emphasis", "Snappier arrival for things that should be noticed"],
  ["ease-in-out", "Continuous and looping motion only"],
] as const;

const controlHeights = [
  ["--control-h-sm", "36px", "Dense, pointer-first contexts only"],
  ["--control-h-md", "44px", "Default for anything a patient taps"],
  ["--control-h-lg", "52px", "Primary calls to action"],
] as const;

const layers = [
  ["--z-base", "0", "Normal flow"],
  ["--z-sticky", "10", "Chat header and composer"],
  ["--z-popover", "40", "Menus and popovers"],
  ["--z-scrim", "50", "Backdrop behind dialogs"],
  ["--z-modal", "60", "Dialogs"],
  ["--z-toast", "70", "Toasts stay above dialogs"],
  ["--z-skip-link", "80", "Skip link always wins"],
] as const;

function TokenRow({ token, note, swatch }: { token: string; note: string; swatch: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      {swatch}
      <span className="flex min-w-0 flex-col">
        <code className="font-mono text-caption text-default">{token}</code>
        <span className="text-caption text-muted">{note}</span>
      </span>
    </li>
  );
}

export default function FoundationsPage() {
  return (
    <>
      <PageHeader title="Foundations">
        The tokens every Smile Desk screen is built from. Patients range from teenagers to grandparents booking for the whole
        family, so the system is tuned for legibility first: large body text, 44px targets, AA contrast everywhere (AAA for
        body copy), and a light and dark theme that both pass.
      </PageHeader>

      <Section
        id="tiers"
        title="Token tiers"
        description="Three layers, each pointing only at the one below it. Changing a brand color is a tier-1 edit; retheming is a tier-2 edit; restyling one component is a tier-3 edit."
      >
        <ol className="grid gap-3 lg:grid-cols-3">
          {[
            [
              "1 · Primitives",
              "styles/primitives.css",
              "Raw OKLCH ramps on one shared lightness ladder, with separate light and dark ramps. No meaning, never used by components.",
              "--p-teal-900",
            ],
            [
              "2 · Semantic",
              "styles/semantic.css",
              "Roles: surfaces, text, borders, intents, focus. Each is a light-dark() pair, so this is the only tier that knows about themes.",
              "--brand-solid",
            ],
            [
              "3 · Component",
              "styles/components.css",
              "Per-component decisions pointing at semantic roles. Restyle one component here without touching any other.",
              "--button-primary-bg",
            ],
          ].map(([title, file, body, example]) => (
            <li key={title} className="flex flex-col gap-2 rounded-xl border border-subtle bg-surface p-5 shadow-raised">
              <span className="text-title font-semibold">{title}</span>
              <code className="font-mono text-caption text-muted">{file}</code>
              <p className="text-body-sm text-secondary">{body}</p>
              <code className="mt-auto w-fit rounded-sm bg-brand-subtle px-2 py-0.5 font-mono text-caption text-brand-text">
                {example}
              </code>
            </li>
          ))}
        </ol>
        <Note title="How one color travels">
          <code className="font-mono">--p-teal-900</code> → <code className="font-mono">--brand-solid</code> →{" "}
          <code className="font-mono">--button-primary-bg</code> → <code className="font-mono">{`<Button variant="primary">`}</code>.
          Tailwind only exposes tier 2 as utilities (<code className="font-mono">bg-brand-solid</code>,{" "}
          <code className="font-mono">text-muted</code>); its default palette is switched off, so an off-system color cannot be
          typed. A test fails the build if a component reaches for a primitive or a raw color.
        </Note>
      </Section>

      <Section
        id="primitives"
        title="Primitive ramps"
        description="Twelve steps per hue (the Radix model): 100–200 backgrounds, 300–500 element fills, 600–800 borders, 900–1000 solid fills, 1100–1200 text. Every hue shares the same lightness per step, so step 900 behaves the same in teal or red. Dark ramps are tuned separately, not inverted."
      >
        {(["light", "dark"] as const).map((mode) => (
          <figure key={mode} className="flex flex-col gap-3">
            <figcaption className="text-title font-semibold">{mode === "light" ? "Light ramps" : "Dark ramps"}</figcaption>
            <div className="overflow-x-auto rounded-xl border border-subtle bg-surface p-4">
              <table className="w-full min-w-[44rem] border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th scope="col" className="sr-only">
                      Ramp
                    </th>
                    {steps.map((step) => (
                      <th key={step} scope="col" className="text-caption font-normal text-muted">
                        {step}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ramps.map((ramp) => (
                    <tr key={ramp.name}>
                      <th scope="row" className="pr-2 text-left">
                        <span className="block text-label font-semibold">{ramp.name}</span>
                        <span className="block text-caption text-muted">{ramp.role}</span>
                      </th>
                      {steps.map((step) => {
                        const token = mode === "light" ? `--p-${ramp.name}-${step}` : `--p-${ramp.name}-dark-${step}`;
                        return (
                          <td key={step}>
                            <div
                              title={token}
                              className="h-10 rounded-sm border border-subtle"
                              style={{ background: `var(${token})` }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </figure>
        ))}
      </Section>

      <Section
        id="semantic"
        title="Semantic colors"
        description="The roles components are allowed to use. Each pane below pins one scheme, so you can compare light and dark side by side."
      >
        <Stage title="Surfaces, text and borders">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-6 pt-6">
            <ul className="flex flex-col gap-3">
              {surfaces.map(([token, note]) => (
                <TokenRow
                  key={token}
                  token={token}
                  note={note}
                  swatch={
                    <span
                      className="size-10 shrink-0 rounded-md border border-default"
                      style={{ background: `var(${token})` }}
                    />
                  }
                />
              ))}
            </ul>
            <ul className="flex flex-col gap-3">
              {foregrounds.map(([token, note]) => (
                <TokenRow
                  key={token}
                  token={token}
                  note={note}
                  swatch={
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-md border border-subtle bg-surface text-title font-bold"
                      style={{ color: `var(${token})` }}
                    >
                      Aa
                    </span>
                  }
                />
              ))}
            </ul>
            <ul className="flex flex-col gap-3">
              {borders.map(([token, note]) => (
                <TokenRow
                  key={token}
                  token={token}
                  note={note}
                  swatch={
                    <span
                      className="size-10 shrink-0 rounded-md border-2 bg-surface"
                      style={{ borderColor: `var(${token})` }}
                    />
                  }
                />
              ))}
              <TokenRow
                token="--focus-ring"
                note="2px solid outline, 2px offset"
                swatch={<span className="size-10 shrink-0 rounded-md bg-surface focus-ring" />}
              />
            </ul>
          </div>
        </Stage>
      </Section>

      <Section
        id="intents"
        title="Intents"
        description="Six intents expose the same six steps, so a component swaps meaning by swapping tone. Solid fills always pair with their --fg-on-* token. Warning pairs with dark ink because amber is too light for white text."
      >
        <Stage title="Intent sets" stacked>
          <div className="overflow-x-auto pt-6">
            <table className="w-full min-w-[40rem] border-separate border-spacing-2">
              <thead>
                <tr>
                  <th scope="col" className="sr-only">
                    Intent
                  </th>
                  {intentSteps.map((step) => (
                    <th key={step} scope="col" className="text-left text-caption font-normal text-muted">
                      -{step}
                    </th>
                  ))}
                  <th scope="col" className="text-left text-caption font-normal text-muted">
                    In use
                  </th>
                </tr>
              </thead>
              <tbody>
                {intents.map((intent) => (
                  <tr key={intent}>
                    <th scope="row" className="pr-2 text-left text-label font-semibold">
                      {intent}
                    </th>
                    {intentSteps.map((step) => (
                      <td key={step}>
                        <div
                          title={`--${intent}-${step}`}
                          className="h-9 min-w-12 rounded-sm border border-subtle"
                          style={{ background: `var(--${intent}-${step})` }}
                        />
                      </td>
                    ))}
                    <td className="whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        <Badge tone={intent} variant="solid">
                          Solid
                        </Badge>
                        <Badge tone={intent}>Soft</Badge>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Stage>
        <Note title="Color is never the only signal">
          Every status pairs its tone with an icon or a word: a cancelled appointment says &ldquo;Cancelled&rdquo;, an unavailable
          time is struck through and labelled, an emergency carries the siren icon.
        </Note>
      </Section>

      <Section
        id="typography"
        title="Typography"
        description="Atkinson Hyperlegible Next, designed by the Braille Institute for low-vision readers: unambiguous I/l/1 and O/0 matter when a patient reads back a phone number or date of birth. Sizes are rem, so the patient's text-size setting (sidebar) scales type, controls and spacing together."
      >
        <div className="flex flex-col divide-y divide-subtle rounded-xl border border-subtle bg-surface">
          {typeRoles.map(([cls, size, role, sample]) => (
            <div key={cls} className="grid gap-2 p-5 md:grid-cols-[14rem_1fr] md:items-baseline">
              <div className="flex flex-col">
                <code className="font-mono text-caption text-default">.{cls}</code>
                <span className="text-caption text-muted">
                  {size} · {role}
                </span>
              </div>
              <p className={`${cls} ${cls === "text-display" || cls === "text-heading" ? "font-bold" : ""}`}>{sample}</p>
            </div>
          ))}
        </div>
        <Note title="Weights">
          Regular (400) for reading, semibold (600) for labels and buttons, bold (700) for headings. Nothing patient-facing goes
          below 14px.
        </Note>
      </Section>

      <Section id="shape" title="Radius & elevation" description="Soft, rounded geometry reads friendly without turning playful. Shadows are named by role, and in dark mode they fade while lighter surfaces carry the elevation.">
        <Stage title="Radius">
          <div className="flex flex-wrap gap-4 pt-6">
            {radii.map((radius) => (
              <div key={radius} className="flex flex-col items-center gap-2">
                <div
                  className="size-16 border-2 border-(color:--brand-border) bg-brand-subtle"
                  style={{ borderRadius: `var(--radius-${radius})` }}
                />
                <code className="font-mono text-caption text-muted">{radius}</code>
              </div>
            ))}
          </div>
        </Stage>
        <Stage title="Elevation">
          <div className="grid gap-5 pt-6 sm:grid-cols-2">
            {elevations.map(([cls, note]) => (
              <div key={cls} className={`flex flex-col gap-1 rounded-lg border border-subtle bg-surface p-4 ${cls}`}>
                <code className="font-mono text-caption text-default">{cls}</code>
                <span className="text-caption text-muted">{note}</span>
              </div>
            ))}
          </div>
        </Stage>
      </Section>

      <Section
        id="motion"
        title="Motion"
        description="Motion confirms an action or shows that something is working; it never decorates. One-shot transitions stay under 400ms; loops get their own lane. With reduced motion turned on, every animation collapses and loaders fall back to text."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-3 rounded-xl border border-subtle bg-surface p-5">
            <span className="text-title font-semibold">Durations</span>
            {durations.map(([token, value, note]) => (
              <div key={token} className="group flex flex-col gap-1.5">
                <span className="flex justify-between gap-2">
                  <code className="font-mono text-caption text-default">{token}</code>
                  <span className="text-caption text-muted">{value}</span>
                </span>
                <span className="text-caption text-muted">{note}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-subtle bg-surface p-5">
            <span className="text-title font-semibold">Loops</span>
            {loops.map(([token, value, note]) => (
              <div key={token} className="flex flex-col gap-1">
                <span className="flex justify-between gap-2">
                  <code className="font-mono text-caption text-default">{token}</code>
                  <span className="text-caption text-muted">{value}</span>
                </span>
                <span className="text-caption text-muted">{note}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-subtle bg-surface p-5">
            <span className="text-title font-semibold">Easing</span>
            {easings.map(([cls, note]) => (
              <div key={cls} className="flex flex-col gap-1">
                <code className="font-mono text-caption text-default">{cls}</code>
                <span className="text-caption text-muted">{note}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section id="layers" title="Sizing & layers" description="Control heights are rem, so they grow with the text-size setting. 44px is our floor for anything tappable, well above the WCAG 2.2 AA minimum of 24px, because tremor and reduced dexterity are common among patients.">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-xl border border-subtle bg-surface p-5">
            <span className="text-title font-semibold">Control heights</span>
            {controlHeights.map(([token, value, note]) => (
              <div key={token} className="flex items-center gap-4">
                <div
                  className="w-20 shrink-0 rounded-(--control-radius) border border-(color:--brand-border) bg-brand-subtle"
                  style={{ height: `var(${token})` }}
                />
                <span className="flex flex-col">
                  <code className="font-mono text-caption text-default">
                    {token} · {value}
                  </code>
                  <span className="text-caption text-muted">{note}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-subtle bg-surface p-5">
            <span className="text-title font-semibold">Z-index registry</span>
            <ul className="flex flex-col gap-2">
              {layers.map(([token, value, note]) => (
                <li key={token} className="grid grid-cols-[9rem_2.5rem_1fr] items-baseline gap-2">
                  <code className="font-mono text-caption text-default">{token}</code>
                  <span className="text-caption text-muted">{value}</span>
                  <span className="text-caption text-muted">{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section id="icons" title="Icons" description="One stroke set on a 24px grid, colored by currentColor. Decorative by default (aria-hidden); pass a label only when the icon carries meaning on its own.">
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-2">
          {iconNames.map((name) => (
            <li
              key={name}
              className="flex flex-col items-center gap-2 rounded-lg border border-subtle bg-surface px-2 py-4 text-secondary"
            >
              <Icon name={name} size="lg" />
              <code className="font-mono text-caption text-muted">{name}</code>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
