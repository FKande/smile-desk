"use client";

import type { ReactNode, Ref, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Field } from "./Field";
import { controlClasses, readOnlyClasses } from "./field-styles";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
  /** Grow with the text (from `rows` up to a cap, then scroll). Uses CSS
   *  field-sizing, no script: browsers without it keep a fixed-height
   *  box that scrolls, a fine fallback. */
  autoGrow?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
};

/** Multi-line text, in the same visual language as Input. */
export function Textarea({ invalid = false, autoGrow = false, rows = 3, className, style, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      /* field-sizing ignores `rows`, so hold the same starting height as a
         minimum: rows x line-height + vertical padding + border. */
      style={autoGrow ? { minHeight: `calc(${rows}lh + 1.25rem + 2px)`, ...style } : style}
      aria-invalid={invalid || undefined}
      className={controlClasses({
        invalid,
        className: cn(
          "block px-3.5 py-2.5",
          readOnlyClasses,
          autoGrow ? "field-sizing-content max-h-80 resize-none" : "resize-y",
          className,
        ),
      })}
      {...rest}
    />
  );
}

type TextareaFieldProps = Omit<TextareaProps, "id"> & {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  id?: string;
  fieldClassName?: string;
};

/** Field + Textarea in one tag. */
export function TextareaField({
  label,
  description,
  error,
  required,
  invalid,
  id,
  fieldClassName,
  ...textarea
}: TextareaFieldProps) {
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
      {(control) => <Textarea {...textarea} {...control} />}
    </Field>
  );
}
