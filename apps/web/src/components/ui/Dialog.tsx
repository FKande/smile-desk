"use client";

import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons/Icon";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";

const widths = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg" } as const;

type DialogProps = {
  open: boolean;
  /** Called with false on Esc, the close button or a click on the scrim. */
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** "danger" marks a destructive confirmation: icon and focus ring turn red.
   *  Pair it with a danger Button and a safe default (data-autofocus). */
  tone?: "default" | "danger";
  icon?: IconName;
  /** Buttons, right-aligned on wide screens and stacked full-width on narrow
   *  ones. Put data-autofocus on the one that should take focus first. */
  actions?: ReactNode;
  size?: keyof typeof widths;
  /** Hide the top-right close button (Esc still closes). */
  hideClose?: boolean;
  className?: string;
  children?: ReactNode;
};

/**
 * A modal built on the native <dialog> and showModal(), so the browser
 * supplies the focus trap, Esc, inert background and the top layer (which
 * sits above every z-index, so no --z-modal is needed here). React owns
 * `open`; the effect below keeps the element in step and focus returns to
 * whatever opened it.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  tone = "default",
  icon,
  actions,
  size = "md",
  hideClose = false,
  className,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  /* Fires for every way the dialog closes (Esc, close(), form method=dialog). */
  function handleClose() {
    returnFocus.current?.focus();
    returnFocus.current = null;
    if (open) onOpenChange(false);
  }

  /* The dialog box itself has no padding, so a click whose target is the
   * <dialog> element landed on the ::backdrop. */
  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onOpenChange(false);
  }

  const glyph = icon ?? (tone === "danger" ? "alert-triangle" : undefined);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      data-tone={tone === "danger" ? "danger" : undefined}
      onClose={handleClose}
      onClick={handleClick}
      className={cn(
        "m-auto w-[calc(100%-2*var(--gutter))] border border-subtle bg-(--dialog-bg) p-0 text-default",
        "rounded-(--dialog-radius) shadow-(--dialog-shadow)",
        "open:animate-rise-in backdrop:bg-(--dialog-scrim) open:backdrop:animate-fade-in",
        "data-[tone=danger]:[--focus-ring:var(--focus-ring-danger)]",
        widths[size],
        className,
      )}
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start gap-3">
          {glyph ? (
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full",
                tone === "danger"
                  ? "bg-(--tone-subtle) text-(color:--tone-text)"
                  : "bg-brand-subtle text-brand-text",
              )}
            >
              <Icon name={glyph} />
            </span>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1.5">
            <h2 id={titleId} className="text-title font-semibold">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-body-sm text-secondary">
                {description}
              </p>
            ) : null}
          </div>
          {hideClose ? null : (
            <IconButton icon="x" label="Close" onClick={() => onOpenChange(false)} className="-mr-2 -mt-2" />
          )}
        </div>
        {children ? <div className="text-body">{children}</div> : null}
        {actions ? (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">
            {actions}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
