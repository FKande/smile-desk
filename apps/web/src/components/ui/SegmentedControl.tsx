"use client";

import { useId } from "react";
import { Icon, type IconName } from "@/components/icons/Icon";
import { cn } from "@/lib/cn";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon?: IconName;
  /** Show only the icon; the label stays as the accessible name. */
  iconOnly?: boolean;
};

type SegmentedControlProps<T extends string> = {
  /** Names the group for assistive tech (rendered visually hidden). */
  legend: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/** A one-of-N choice built on native radio inputs, so arrow keys, focus and
 *  screen-reader semantics come from the browser rather than custom code. */
export function SegmentedControl<T extends string>({
  legend,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const name = useId();
  // A div with role="radiogroup" rather than <fieldset>: fieldset/legend carry
  // browser layout quirks that break flex height and centering. Radios sharing
  // a name still get arrow-key navigation natively.
  return (
    <div
      role="radiogroup"
      aria-label={legend}
      // Never wraps (a wrapped segmented control reads as two controls). On a
      // container too narrow for every option it scrolls sideways instead, so
      // the focus ring sits inside each pill where the scroll edge can't clip it.
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-subtle bg-subtle p-0.5 [scrollbar-width:none]",
        className,
      )}
    >
      {options.map((option) => (
        <label
          key={option.value}
          title={option.iconOnly ? option.label : undefined}
          className={cn(
            "inline-flex h-8 shrink-0 cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-label font-semibold leading-none text-secondary",
            "transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-out",
            "hover:text-default",
            "has-checked:bg-surface has-checked:text-default has-checked:shadow-raised",
            "has-focus-visible:focus-ring-inset",
            option.iconOnly ? "w-8" : "min-w-10 px-3",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {/* On phones a labeled segment drops its icon (the word carries the
              meaning), so three or four options still fit without scrolling. */}
          {option.icon ? (
            <Icon name={option.icon} size="sm" className={option.iconOnly ? undefined : "max-sm:hidden"} />
          ) : null}
          <span className={option.iconOnly ? "sr-only" : undefined}>{option.label}</span>
        </label>
      ))}
    </div>
  );
}
