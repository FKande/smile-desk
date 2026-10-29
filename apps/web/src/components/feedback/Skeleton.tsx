import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const radii = { sm: "rounded-sm", md: "rounded-md", lg: "rounded-lg", xl: "rounded-xl", full: "rounded-full" } as const;
export type SkeletonRadius = keyof typeof radii;

/* A wide gradient band slid across the block by the shimmer keyframes. Under
 * reduced motion the image is dropped and the block rests on the base color. */
const shimmer =
  "bg-(--skeleton-base) bg-[linear-gradient(90deg,var(--skeleton-base)_30%,var(--skeleton-shine)_50%,var(--skeleton-base)_70%)] " +
  "bg-size-[200%_100%] animate-shimmer motion-reduce:animate-none motion-reduce:bg-none";

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  radius?: SkeletonRadius;
};

/** A placeholder block. Size it with className (h-*, w-*). It is hidden from
 *  assistive tech: put aria-busy="true" and a text label on the container it
 *  stands in for, so the wait is announced once, not per block. */
export function Skeleton({ radius = "md", className, ...rest }: SkeletonProps) {
  return <div aria-hidden="true" className={cn(shimmer, radii[radius], className)} {...rest} />;
}

type SkeletonTextProps = {
  lines?: number;
  className?: string;
};

/** n lines at body-text rhythm; the last one runs short like a real paragraph. */
export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-2.5", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          radius="full"
          className={cn("h-3.5", i === lines - 1 && lines > 1 ? "w-3/5" : "w-full")}
        />
      ))}
    </div>
  );
}
