import { cn } from "@/lib/cn";

const sizes = { sm: "size-4", md: "size-5", lg: "size-8" } as const;

type SpinnerProps = {
  size?: keyof typeof sizes;
  /** Read by screen readers. Pass an empty string when a parent already
   *  announces the busy state (e.g. a loading Button with aria-busy). */
  label?: string;
  className?: string;
};

/** Indeterminate spinner. The arc takes currentColor, the track a faint
 *  token, so it reads on any surface. Under reduced motion it stops
 *  rotating and the label carries the meaning. */
export function Spinner({ size = "md", label = "Loading", className }: SpinnerProps) {
  return (
    <span role={label ? "status" : undefined} className={cn("inline-flex", className)}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={cn(sizes[size], "animate-spin motion-reduce:animate-none")}
      >
        <circle cx="12" cy="12" r="9.5" stroke="var(--spinner-track)" strokeWidth="3" />
        <path d="M21.5 12A9.5 9.5 0 0 0 12 2.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
