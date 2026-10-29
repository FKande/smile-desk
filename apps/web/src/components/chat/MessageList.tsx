"use client";

import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { Icon } from "@/components/icons/Icon";
import { cn } from "@/lib/cn";

/* How close to the bottom (px) still counts as "reading the latest". */
const STICK_THRESHOLD = 96;

export type MessageListProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children: ReactNode;
  /** Accessible name of the log. */
  label?: string;
  /** Change this (e.g. to the patient's latest message id) to jump to the
   *  end even when they had scrolled up: sending a message should always
   *  show it. */
  scrollToEndKey?: string | number;
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The conversation thread. A polite live log, so screen readers announce new
 * messages without interrupting. It follows new content only while the
 * patient is at (or near) the bottom; once they scroll up to reread, it stays
 * put and offers a "New messages" button instead of yanking them down.
 * Give it a bounded height (flex-1 in a fixed-height column, or a max-h).
 */
export function MessageList({
  children,
  label = "Conversation",
  scrollToEndKey,
  className,
  ...rest
}: MessageListProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const lastTopRef = useRef(0);
  const [hasUnseen, setHasUnseen] = useState(false);

  function scrollToEnd(smooth: boolean) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({
      top: scroller.scrollHeight,
      behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",
    });
  }

  // Follow growth (new messages, a slot picker expanding, images loading)
  // only while stuck to the bottom.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    scrollToEnd(false);
    const observer = new ResizeObserver(() => {
      if (stickRef.current) scrollToEnd(true);
      else setHasUnseen(true);
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (scrollToEndKey === undefined) return;
    stickRef.current = true;
    scrollToEnd(true);
  }, [scrollToEndKey]);

  function handleScroll() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    const movedUp = scroller.scrollTop < lastTopRef.current;
    lastTopRef.current = scroller.scrollTop;
    // Only an upward scroll by the patient unsticks; our own smooth scroll
    // passes through "far from the bottom" on its way down and must not.
    if (distance <= STICK_THRESHOLD) {
      stickRef.current = true;
      setHasUnseen(false);
    } else if (movedUp) {
      stickRef.current = false;
    }
  }

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
      <div
        ref={scrollerRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label={label}
        tabIndex={0}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-(--gutter) py-4 focused:focus-ring-inset"
        {...rest}
      >
        <div ref={contentRef} className="flex flex-col">
          {children}
        </div>
      </div>

      {hasUnseen ? (
        <button
          type="button"
          onClick={() => {
            stickRef.current = true;
            setHasUnseen(false);
            scrollToEnd(true);
          }}
          className={cn(
            "absolute bottom-3 left-1/2 z-(--z-sticky) inline-flex min-h-(--control-h-md) -translate-x-1/2 cursor-pointer items-center gap-1.5",
            "rounded-full border border-subtle bg-surface-raised px-4 text-label font-semibold text-default shadow-overlay",
            "animate-rise-in hovered:bg-hover focused:focus-ring",
          )}
        >
          <Icon name="chevron-down" size="sm" />
          New messages
        </button>
      ) : null}
    </div>
  );
}

export type DateDividerProps = { children: ReactNode; className?: string };

/** "Today", "Yesterday", "Tue, Nov 4": separates days in the thread. */
export function DateDivider({ children, className }: DateDividerProps) {
  return (
    <div className={cn("my-4 flex items-center gap-3 first:mt-0", className)}>
      <span aria-hidden="true" className="flex-1 border-t border-subtle" />
      <span className="text-caption font-semibold text-muted">{children}</span>
      <span aria-hidden="true" className="flex-1 border-t border-subtle" />
    </div>
  );
}
