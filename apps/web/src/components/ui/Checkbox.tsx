"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { Icon } from "@/components/icons/Icon";
import { cn } from "@/lib/cn";
import { FieldError } from "./Field";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> & {
  label: ReactNode;
  /** Extra context under the label, linked with aria-describedby. */
  description?: ReactNode;
  /** "Some selected": shows a dash and is announced as mixed. */
  indeterminate?: boolean;
  invalid?: boolean;
  /** Shown under the row and announced. Implies invalid. */
  error?: ReactNode;
  ref?: Ref<HTMLInputElement>;
};

/** A native checkbox with a custom box. The real <input> is the box (with
 *  appearance: none), so focus, keyboard, form submission and forced-state
 *  data attributes all land on the element that owns the semantics. The
 *  whole label row is the hit area, at least 44px tall. */
export function Checkbox({
  label,
  description,
  indeterminate = false,
  invalid = false,
  error,
  id,
  className,
  ref,
  ...rest
}: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;
  const errorId = `${inputId}-error`;
  const isInvalid = invalid || Boolean(error);
  const describedBy = [description ? descriptionId : null, error ? errorId : null].filter(Boolean).join(" ");

  /* `indeterminate` exists only as a DOM property, so set it through the ref. */
  function setRef(element: HTMLInputElement | null) {
    if (element) element.indeterminate = indeterminate;
    if (typeof ref === "function") ref(element);
    else if (ref) ref.current = element;
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <label
        htmlFor={inputId}
        className="flex min-h-(--control-h-md) cursor-pointer items-start gap-3 py-2.5 text-body text-default has-disabled:cursor-not-allowed has-disabled:text-disabled"
      >
        {/* One line tall, so the box centers on the first line of a wrapped label. */}
        <span className="grid h-lh shrink-0 place-items-center">
          <input
            ref={setRef}
            id={inputId}
            type="checkbox"
            aria-invalid={isInvalid || undefined}
            aria-describedby={describedBy || undefined}
            className={cn(
              "peer col-start-1 row-start-1 size-5 cursor-pointer appearance-none rounded-(--check-radius) border-2 bg-(--check-bg)",
              "transition-[background-color,border-color] duration-(--duration-fast) ease-out",
              isInvalid
                ? "border-(color:--check-border-invalid)"
                : "border-(color:--check-border) hovered:border-(color:--check-border-hover)",
              "checked:border-(color:--check-bg-checked) checked:bg-(--check-bg-checked)",
              "indeterminate:border-(color:--check-bg-checked) indeterminate:bg-(--check-bg-checked)",
              "focused:focus-ring",
              "is-disabled:cursor-not-allowed is-disabled:border-subtle is-disabled:bg-disabled",
            )}
            {...rest}
          />
          <Icon
            name="check"
            size="sm"
            strokeWidth={3}
            className="pointer-events-none invisible col-start-1 row-start-1 text-(color:--check-fg-checked) peer-checked:visible peer-indeterminate:invisible peer-disabled:text-disabled"
          />
          <Icon
            name="minus"
            size="sm"
            strokeWidth={3}
            className="pointer-events-none invisible col-start-1 row-start-1 text-(color:--check-fg-checked) peer-indeterminate:visible peer-disabled:text-disabled"
          />
        </span>
        <span className="font-semibold">{label}</span>
      </label>
      {description ? (
        <p id={descriptionId} className="-mt-2 pb-2 pl-8 text-body-sm text-secondary">
          {description}
        </p>
      ) : null}
      {error ? (
        <FieldError id={errorId} className="pl-8">
          {error}
        </FieldError>
      ) : null}
    </div>
  );
}
