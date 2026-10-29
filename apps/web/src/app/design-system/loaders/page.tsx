import { ProgressBar } from "@/components/feedback/ProgressBar";
import { Skeleton, SkeletonText } from "@/components/feedback/Skeleton";
import { Spinner } from "@/components/feedback/Spinner";
import { ToothLoader } from "@/components/feedback/ToothLoader";
import { Card } from "@/components/ui/Card";
import { Note, PageHeader, Section, Stage } from "../_kit/Doc";
import { LoadingButtonDemo, SlotListDemo, StepProgressDemo } from "./_demos";

export default function Page() {
  return (
    <div className="flex flex-col gap-16">
      <PageHeader title="Loaders">
        Waiting is part of the conversation. Every loader says what is happening in words, so the meaning survives a
        screen reader and reduced motion alike. Pick the quietest one that fits.
      </PageHeader>

      {/* ------------------------------------------------------------- Spinner */}
      <Section
        id="spinner"
        title="Spinner"
        description="A small indeterminate spinner for inline, short waits: inside a button while booking, next to a line of text. The arc takes currentColor; the track is --spinner-track."
      >
        <Stage title="Sizes" source="src/components/feedback/Spinner.tsx">
          <div className="flex flex-wrap items-center gap-6 text-brand-text">
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
          </div>
        </Stage>
        <Stage title="In context">
          <div className="flex flex-wrap items-center gap-4">
            <LoadingButtonDemo />
            <span className="inline-flex items-center gap-2 text-body-sm text-secondary">
              <Spinner size="sm" label="" />
              Saving your details
            </span>
          </div>
        </Stage>
      </Section>

      {/* ------------------------------------------------------------ Skeleton */}
      <Section
        id="skeleton"
        title="Skeleton"
        description="A placeholder in the shape of the content to come, so the layout does not jump when it lands. Blocks are aria-hidden; the container carries aria-busy and one text label."
      >
        <Stage title="Blocks and text" source="src/components/feedback/Skeleton.tsx">
          <Card className="max-w-md" aria-busy="true">
            <span className="sr-only">Loading your appointment</span>
            <div className="flex items-center gap-3">
              <Skeleton radius="full" className="size-10" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton radius="full" className="h-4 w-2/5" />
                <Skeleton radius="full" className="h-3.5 w-1/4" />
              </div>
            </div>
            <SkeletonText lines={3} />
          </Card>
        </Stage>
        <Stage
          title="A time-slot list loading"
          description="The skeleton matches the slot buttons' height and grid, so nothing shifts when the times arrive."
          schemes="current"
        >
          <SlotListDemo />
        </Stage>
      </Section>

      {/* ------------------------------------------------------------ Progress */}
      <Section
        id="progress"
        title="ProgressBar"
        description="Determinate when there is a known amount (role=progressbar with aria-valuenow, and aria-valuetext for steps), indeterminate when there is not."
      >
        <Stage title="Determinate and indeterminate" source="src/components/feedback/ProgressBar.tsx">
          <div className="flex max-w-md flex-col gap-6">
            <ProgressBar label="Uploading insurance card" value={64} showValue />
            <ProgressBar label="Sending your records to the office" size="sm" />
          </div>
        </Stage>
        <Stage title="Registration steps" schemes="current">
          <StepProgressDemo />
        </Stage>
      </Section>

      {/* -------------------------------------------------------- Tooth loader */}
      <Section
        id="tooth-loader"
        title="ToothLoader"
        description="The branded loader for the one wait patients notice most: checking the schedule. A soft band of brand color sweeps through the tooth, clipped to its outline, at a calm pace. It always shows its words."
      >
        <Stage title="Sizes" source="src/components/feedback/ToothLoader.tsx">
          <div className="flex flex-col gap-5">
            <ToothLoader size="sm" label="Looking up your appointment…" />
            <ToothLoader size="md" />
            <ToothLoader size="lg" label="Finding back-to-back times for your family…" />
          </div>
        </Stage>
        <Note title="Use it for lookups, not for typing">
          The tooth loader stands for the assistant checking something real (availability, a patient record). While
          the assistant is composing a reply, use the typing indicator from the chat set instead.
        </Note>
      </Section>

      {/* ------------------------------------------------------ Reduced motion */}
      <Section
        id="reduced-motion"
        title="Reduced motion"
        description="When the system asks for reduced motion, base.css collapses every animation and transition, and each loader also opts out explicitly so it rests in a sensible still frame."
      >
        <div className="overflow-x-auto">
          <table className="w-full max-w-3xl border-collapse text-left text-body-sm">
            <thead>
              <tr className="border-b border-subtle text-caption text-muted">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Loader
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  With motion
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Reduced motion
                </th>
              </tr>
            </thead>
            <tbody className="text-default">
              {[
                ["Spinner", "Arc rotates", "Arc rests; screen-reader label remains"],
                ["Skeleton", "Shine sweeps across", "Flat base color; container keeps aria-busy and its label"],
                ["ProgressBar (indeterminate)", "Segment sweeps", "Faint full-width fill; visible label remains"],
                ["ToothLoader", "Sheen passes through the tooth", "Still, filled tooth beside the same words"],
              ].map(([name, motion, reduced]) => (
                <tr key={name} className="border-b border-subtle align-top">
                  <th scope="row" className="py-2.5 pr-4 font-semibold">
                    {name}
                  </th>
                  <td className="py-2.5 pr-4 text-secondary">{motion}</td>
                  <td className="py-2.5 text-secondary">{reduced}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note title="Check it yourself">
          Turn on Reduce motion in your OS (or emulate prefers-reduced-motion in DevTools) and revisit this page. Every
          loader above should hold still and still tell you what it is doing.
        </Note>
      </Section>
    </div>
  );
}
