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
  return (
    <fieldset
      className={cn(
        "inline-flex h-(--control-h-md) items-stretch gap-1 rounded-full border border-subtle bg-subtle p-1",
        className,
      )}
    >
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          title={option.iconOnly ? option.label : undefined}
          className={cn(
            "inline-flex cursor-pointer select-none items-center justify-center gap-1.5 rounded-full text-label font-semibold text-secondary",
            "transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-out",
            "hover:text-default",
            "has-checked:bg-surface has-checked:text-default has-checked:shadow-raised",
            "has-focus-visible:focus-ring",
            option.iconOnly ? "aspect-square" : "px-3",
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
          {option.icon ? <Icon name={option.icon} size="sm" /> : null}
          <span className={option.iconOnly ? "sr-only" : undefined}>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
