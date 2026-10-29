"use client";

import { useId, type ReactNode } from "react";
import { Icon } from "@/components/icons/Icon";
import { cn } from "@/lib/cn";

/** Spread onto the control: <Field …>{(control) => <Input {...control} />}</Field>.
 *  `invalid` is consumed by Input/Textarea/Select, which turn it into
 *  aria-invalid and the danger border. */
export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-required"?: true;
  invalid: boolean;
};

type FieldProps = {
  label: ReactNode;
  /** Hint shown under the label, e.g. the expected format. */
  description?: ReactNode;
  /** Shown under the control and announced when it appears. Implies invalid. */
  error?: ReactNode;
  /** Marks the field invalid without a message (e.g. a group error elsewhere). */
  invalid?: boolean;
  required?: boolean;
  /** Use a known id instead of a generated one. */
  id?: string;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
};

/** Label, hint and error around one control, with the ids wired for you.
 *  The required state is said in words ("Required"), not an asterisk, and
 *  reaches assistive tech through aria-required on the control. Native
 *  `required` is left off so the browser's own bubbles never compete with
 *  our error messages. */
export function Field({
  label,
  description,
  error,
  invalid = false,
  required = false,
  id,
  className,
  children,
}: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const descriptionId = `${controlId}-description`;
  const errorId = `${controlId}-error`;
  const hasError = Boolean(error);
  const describedBy = [description ? descriptionId : null, hasError ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={controlId} className="flex items-baseline gap-2 text-label font-semibold text-default">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-caption font-normal text-muted">
            Required
          </span>
        ) : null}
      </label>
      {description ? (
        <p id={descriptionId} className="text-body-sm text-secondary">
          {description}
        </p>
      ) : null}
      {children({
        id: controlId,
        "aria-describedby": describedBy || undefined,
        "aria-required": required || undefined,
        invalid: invalid || hasError,
      })}
      {hasError ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

/** An error line: icon plus words, never color alone. It mounts only when
 *  there is an error, so role="alert" announces it exactly once. */
export function FieldError({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <p
      id={id}
      role="alert"
      className={cn("flex items-start gap-1.5 text-body-sm font-semibold text-(color:--field-error-fg)", className)}
    >
      <span className="flex h-lh items-center">
        <Icon name="alert-circle" size="sm" />
      </span>
      {children}
    </p>
  );
}
