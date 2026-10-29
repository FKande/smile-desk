"use client";

import type { ButtonHTMLAttributes, Ref } from "react";
import { Spinner } from "@/components/feedback/Spinner";
import { Icon, type IconName } from "@/components/icons/Icon";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./button-styles";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: IconName;
  /** Required: an icon-only button has no other accessible name. */
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

/** A square (circular) button holding a single icon. Same variants, states
 *  and sizes as Button; the label becomes aria-label and the native tooltip. */
export function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "md",
  loading = false,
  className,
  type = "button",
  title,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={title ?? label}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      className={buttonClasses({ variant, size, iconOnly: true, className })}
      {...rest}
    >
      {loading ? <Spinner size="sm" label="" /> : <Icon name={icon} size={size === "lg" ? "lg" : "md"} />}
    </button>
  );
}
