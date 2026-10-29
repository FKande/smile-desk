"use client";

import { useId, useState, type ButtonHTMLAttributes, type MouseEvent, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/cn";

type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "children" | "value"> & {
  label: ReactNode;
  description?: ReactNode;
  /** Controlled state. Leave undefined and use defaultChecked to let the switch own it. */
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  ref?: Ref<HTMLButtonElement>;
};

/** An on/off setting that applies immediately (no submit), e.g. "Text me
 *  reminders". For a choice submitted with a form, use Checkbox.
 *
 *  A <button role="switch">: Space and Enter toggle it natively. The track is
 *  small, but the button around it is a full 44px square and the label is
 *  clickable too. States key off the button (group-*) because the button,
 *  not the track, receives focus, hover and the catalog's data-state. */
export function Switch({
  label,
  description,
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  id,
  className,
  onClick,
  ...rest
}: SwitchProps) {
  const generatedId = useId();
  const buttonId = id ?? generatedId;
  const labelId = `${buttonId}-label`;
  const descriptionId = `${buttonId}-description`;
  const [internal, setInternal] = useState(defaultChecked);
  const isOn = checked ?? internal;

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (checked === undefined) setInternal(!isOn);
    onCheckedChange?.(!isOn);
  }

  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex min-h-(--control-h-md) flex-col justify-center gap-0.5 py-2">
        <label
          id={labelId}
          htmlFor={buttonId}
          className={cn("text-body font-semibold", disabled ? "cursor-not-allowed text-disabled" : "cursor-pointer text-default")}
        >
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="text-body-sm text-secondary">
            {description}
          </p>
        ) : null}
      </div>
      <button
        id={buttonId}
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={handleClick}
        className="group relative grid size-(--control-h-md) shrink-0 cursor-pointer place-items-center rounded-full outline-hidden is-disabled:cursor-not-allowed"
        {...rest}
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex h-6 w-11 items-center rounded-full border-2 p-0.5",
            "transition-[background-color,border-color] duration-(--duration-fast) ease-out",
            "border-(color:--switch-track-border) bg-(--switch-track)",
            "group-hover:border-(color:--switch-track-border-hover) group-data-[state=hover]:border-(color:--switch-track-border-hover)",
            "group-aria-checked:border-(color:--switch-track-checked) group-aria-checked:bg-(--switch-track-checked)",
            "group-aria-checked:group-hover:border-(color:--switch-track-checked-hover) group-aria-checked:group-hover:bg-(--switch-track-checked-hover)",
            "group-aria-checked:group-data-[state=hover]:border-(color:--switch-track-checked-hover) group-aria-checked:group-data-[state=hover]:bg-(--switch-track-checked-hover)",
            "group-focus-visible:focus-ring group-data-[state=focus]:focus-ring",
            "group-disabled:border-transparent group-disabled:bg-disabled group-data-[state=disabled]:border-transparent group-data-[state=disabled]:bg-disabled",
          )}
        >
          <span
            className={cn(
              "size-4 rounded-full bg-(--switch-thumb) shadow-raised",
              "transition-[translate,width] duration-(--duration-fast) ease-out",
              "group-active:w-5 group-data-[state=active]:w-5",
              "group-aria-checked:translate-x-5 group-aria-checked:group-active:translate-x-4 group-aria-checked:group-data-[state=active]:translate-x-4",
              "group-disabled:bg-(--switch-thumb-disabled) group-disabled:shadow-none",
              "group-data-[state=disabled]:bg-(--switch-thumb-disabled) group-data-[state=disabled]:shadow-none",
            )}
          />
        </span>
      </button>
    </div>
  );
}
