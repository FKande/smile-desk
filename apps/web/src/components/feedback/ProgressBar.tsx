import { useId } from "react";
import { cn } from "@/lib/cn";

const heights = { sm: "h-1.5", md: "h-2.5" } as const;

type ProgressBarProps = {
  /** Visible label, also the bar's accessible name. */
  label: string;
  /** Omit for indeterminate ("working on it, no estimate"). */
  value?: number;
  max?: number;
  /** Spoken instead of a bare percentage, e.g. "Step 2 of 4". */
  valueText?: string;
  /** Show valueText (or the percentage) to the right of the label. */
  showValue?: boolean;
  size?: keyof typeof heights;
  className?: string;
};

/** A linear progress bar. Determinate bars expose aria-valuenow; the
 *  indeterminate one sweeps a segment and, under reduced motion, rests as a
 *  faint full-width fill while the label carries the meaning. */
export function ProgressBar({
  label,
  value,
  max = 100,
  valueText,
  showValue = false,
  size = "md",
  className,
}: ProgressBarProps) {
  const labelId = useId();
  const determinate = value !== undefined;
  const clamped = determinate ? Math.min(Math.max(value, 0), max) : 0;
  const percent = max > 0 ? Math.round((clamped / max) * 100) : 0;
  const shownValue = valueText ?? `${percent}%`;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3 text-label">
        <span id={labelId} className="font-semibold text-default">
          {label}
        </span>
        {showValue && determinate ? <span className="text-muted tabular-nums">{shownValue}</span> : null}
      </div>
      <div
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={determinate ? 0 : undefined}
        aria-valuemax={determinate ? max : undefined}
        aria-valuenow={determinate ? clamped : undefined}
        aria-valuetext={determinate ? valueText : undefined}
        className={cn("relative w-full overflow-hidden rounded-full bg-(--progress-track)", heights[size])}
      >
        {determinate ? (
          <div
            className="h-full rounded-full bg-(--progress-fill) transition-[width] duration-(--duration-slow) ease-out"
            style={{ width: `${percent}%` }}
          />
        ) : (
          <div
            className={cn(
              "absolute inset-y-0 left-0 w-2/5 rounded-full bg-(--progress-fill) animate-progress",
              "motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-40",
            )}
          />
        )}
      </div>
    </div>
  );
}
