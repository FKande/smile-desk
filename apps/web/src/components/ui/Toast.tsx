"use client";

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons/Icon";
import { cn } from "@/lib/cn";

export const toastTones = ["neutral", "success", "info", "warning", "danger"] as const;
export type ToastTone = (typeof toastTones)[number];

const icons: Record<ToastTone, IconName | null> = {
  neutral: null,
  success: "check",
  info: "info",
  warning: "alert-triangle",
  danger: "x",
};

export type ToastOptions = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milliseconds before it leaves on its own; Infinity keeps it until dismissed. */
  duration?: number;
};
type ToastRecord = ToastOptions & { id: number };

type ToastApi = {
  /** Shows a toast and returns its id. */
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/** Read the API from anywhere under a ToastProvider. */
export function useToast(): ToastApi {
  const api = use(ToastContext);
  if (!api) throw new Error("useToast must be used inside a <ToastProvider>.");
  return api;
}

const DEFAULT_DURATION = 6000; /* long enough to read twice at a calm pace */
const MAX_VISIBLE = 3;

/**
 * Owns the toast queue and the one live region they render into. The region
 * exists from first paint (role="status", polite) so screen readers are
 * already listening when a toast arrives. Toasts confirm something that
 * already happened; anything that needs a decision belongs in a Dialog, and
 * anything urgent in an inline Alert.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((current) => [...current, { ...options, id }].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-(--z-toast) flex flex-col items-center gap-2 p-(--gutter) pb-6"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastRecord; onDismiss: () => void }) {
  const { title, description, tone = "neutral", duration = DEFAULT_DURATION } = toast;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const remaining = useRef(duration);
  const paused = hovered || focused;

  /* Count down only while nobody is reading or tabbing through it; pausing
   * banks the time left so resuming does not restart the full duration. */
  useEffect(() => {
    if (paused || !Number.isFinite(remaining.current)) return;
    const startedAt = Date.now();
    const timer = window.setTimeout(onDismiss, remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - startedAt;
    };
  }, [paused, onDismiss]);

  const glyph = icons[tone];
  return (
    <div
      data-tone={tone}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={cn(
        "pointer-events-auto flex w-full max-w-md animate-rise-in items-start gap-3 rounded-(--toast-radius)",
        "bg-(--toast-bg) py-3 pl-4 pr-2 text-(color:--toast-fg) shadow-(--toast-shadow)",
        /* The brand ring disappears on the inverse surface; use its ink instead. */
        "[--focus-ring:var(--toast-fg)]",
      )}
    >
      {glyph ? (
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-(--tone-solid) text-(color:--tone-on-solid)">
          <Icon name={glyph} size="sm" />
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
        <p className="text-body-sm font-semibold">{title}</p>
        {description ? <p className="text-body-sm">{description}</p> : null}
      </div>
      {/* Not IconButton: its ghost colors are tuned for light surfaces, and
          this sits on the inverse surface. */}
      <button
        type="button"
        aria-label="Dismiss notification"
        title="Dismiss"
        onClick={onDismiss}
        className={cn(
          "-my-1.5 inline-flex size-(--control-h-md) shrink-0 cursor-pointer items-center justify-center rounded-full",
          "text-(color:--toast-fg) transition-[background-color] duration-(--duration-fast) ease-out",
          "hovered:bg-(--toast-fg)/15 focused:focus-ring",
        )}
      >
        <Icon name="x" size="md" />
      </button>
    </div>
  );
}
