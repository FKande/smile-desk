"use client";

import type { ButtonHTMLAttributes, MouseEvent, Ref } from "react";
import { Spinner } from "@/components/feedback/Spinner";
import { Icon, type IconName } from "@/components/icons/Icon";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./button-styles";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner in place of iconStart and blocks clicks, but keeps the
   *  button focusable and full-color so the pending action stays readable.
   *  Change the label too ("Booking…") so the busy state is put into words. */
  loading?: boolean;
  iconStart?: IconName;
  iconEnd?: IconName;
  fullWidth?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  iconStart,
  iconEnd,
  fullWidth,
  className,
  type = "button",
  onClick,
  children,
  ...rest
}: ButtonProps) {
  const iconSize = size === "lg" ? "md" : "sm";

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      onClick={handleClick}
      {...rest}
    >
      {loading ? <Spinner size="sm" label="" /> : iconStart ? <Icon name={iconStart} size={iconSize} /> : null}
      {children}
      {iconEnd && !loading ? <Icon name={iconEnd} size={iconSize} /> : null}
    </button>
  );
}
