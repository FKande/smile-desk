"use client";

import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { Icon, type IconName } from "@/components/icons/Icon";
import { cn } from "@/lib/cn";
import { Field } from "./Field";
import { controlClasses, readOnlyClasses, type ControlSize } from "./field-styles";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  /** Sets aria-invalid and the danger border. Field passes it for you. */
  invalid?: boolean;
  size?: ControlSize;
  /** Decorative only: the label must still say what the field is. */
  icon?: IconName;
  ref?: Ref<HTMLInputElement>;
};

/** A single-line text control (text, tel, email, date …). Pair it with Field
 *  for the label and messages, or use TextField below. */
export function Input({ invalid = false, size = "md", icon, className, type = "text", ...rest }: InputProps) {
  const input = (
    <input
      type={type}
      aria-invalid={invalid || undefined}
      className={controlClasses({ invalid, size, className: cn(readOnlyClasses, icon && "pl-10", className) })}
      {...rest}
    />
  );
  if (!icon) return input;
  return (
    <div className="relative w-full">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-(color:--input-icon)">
        <Icon name={icon} size="sm" />
      </span>
      {input}
    </div>
  );
}

type TextFieldProps = Omit<InputProps, "id"> & {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  id?: string;
  fieldClassName?: string;
};

/** Field + Input in one tag, for the common case. */
export function TextField({ label, description, error, required, invalid, id, fieldClassName, ...input }: TextFieldProps) {
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
      {(control) => <Input {...input} {...control} />}
    </Field>
  );
}
