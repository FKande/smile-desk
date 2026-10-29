"use client";

import type { ReactNode, Ref, SelectHTMLAttributes } from "react";
import { Icon } from "@/components/icons/Icon";
import { cn } from "@/lib/cn";
import { Field } from "./Field";
import { controlClasses, type ControlSize } from "./field-styles";

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  invalid?: boolean;
  size?: ControlSize;
  /** A first, unselectable "Choose …" option. Pair with defaultValue="" (or
   *  value="") so it shows until the patient picks something. */
  placeholder?: string;
  ref?: Ref<HTMLSelectElement>;
};

/** A native <select> dressed to match Input. Native on purpose: keyboard,
 *  screen readers and the phone's own picker all work with zero custom code,
 *  which a hand-built listbox would have to re-earn. */
export function Select({ invalid = false, size = "md", placeholder, className, children, ...rest }: SelectProps) {
  return (
    <div className="relative w-full">
      <select
        aria-invalid={invalid || undefined}
        className={controlClasses({
          invalid,
          size,
          className: cn("cursor-pointer appearance-none truncate pr-10", className),
        })}
        {...rest}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {children}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-(color:--input-icon)">
        <Icon name="chevron-down" size="sm" />
      </span>
    </div>
  );
}

type SelectFieldProps = Omit<SelectProps, "id"> & {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  id?: string;
  fieldClassName?: string;
};

/** Field + Select in one tag. */
export function SelectField({
  label,
  description,
  error,
  required,
  invalid,
  id,
  fieldClassName,
  ...select
}: SelectFieldProps) {
  return (
    <Field
      label={label}
      description={description}
      error={error}
      invalid={invalid}
      required={required}
      id={id}
      className={fieldClassName}
    >
      {(control) => <Select {...select} {...control} />}
    </Field>
  );
}
