import { useId } from "react";
import { TOOTH_PATH } from "@/components/icons/Icon";
import { cn } from "@/lib/cn";

const sizes = {
  sm: { glyph: "size-6", text: "text-body-sm" },
  md: { glyph: "size-8", text: "text-body-sm" },
  lg: { glyph: "size-12", text: "text-body" },
} as const;

type ToothLoaderProps = {
  /** Always visible: it is what the patient actually reads while waiting. */
  label?: string;
  size?: keyof typeof sizes;
  className?: string;
};

/**
 * The branded "one moment" loader for schedule lookups. A soft band of brand
 * color sweeps diagonally through the tooth glyph, clipped to its outline,
 * then rests before the next pass. Under reduced motion the band is removed
 * and a still, filled tooth remains next to the words.
 */
export function ToothLoader({ label = "Checking available times…", size = "md", className }: ToothLoaderProps) {
  const id = useId();
  const clipId = `${id}-clip`;
  const sheenId = `${id}-sheen`;
  const { glyph, text } = sizes[size];

  return (
    <span role="status" className={cn("inline-flex items-center gap-3 text-secondary", className)}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={cn(glyph, "shrink-0")}>
        <defs>
          <clipPath id={clipId}>
            <path d={TOOTH_PATH} />
          </clipPath>
          <linearGradient id={sheenId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" style={{ stopColor: "var(--tooth-loader-sheen)", stopOpacity: 0 }} />
            <stop offset="0.5" style={{ stopColor: "var(--tooth-loader-sheen)", stopOpacity: 0.9 }} />
            <stop offset="1" style={{ stopColor: "var(--tooth-loader-sheen)", stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path d={TOOTH_PATH} className="fill-(--tooth-loader-fill)" />
        <g clipPath={`url(#${clipId})`}>
          <g transform="rotate(20 12 12)">
            <rect
              x="0"
              y="-6"
              width="9"
              height="36"
              fill={`url(#${sheenId})`}
              className="animate-progress [transform-box:fill-box] motion-reduce:hidden"
              style={{ animationDuration: "var(--tooth-loader-duration)" }}
            />
          </g>
        </g>
        <path
          d={TOOTH_PATH}
          fill="none"
          strokeWidth={1.5}
          strokeLinejoin="round"
          className="stroke-(--tooth-loader-stroke)"
        />
      </svg>
      <span className={cn(text, "font-medium")}>{label}</span>
    </span>
  );
}
