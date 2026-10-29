/* Client for the office team's alert queue (apps/api: StaffController). Every
 * call carries the admin token in x-admin-token; the API answers 401 for a
 * wrong token and 503 when ADMIN_TOKEN is not set on the server. */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");

export type NotificationKind = "emergency" | "escalation" | "callback";
export type NotificationPriority = "urgent" | "high" | "normal";
export type NotificationStatus = "open" | "acknowledged";

export type StaffNotification = {
  id: string;
  kind: NotificationKind;
  priority: NotificationPriority;
  patientId: string | null;
  conversationId: string | null;
  summary: string;
  details: Record<string, unknown> | null;
  status: NotificationStatus;
  /** UTC ISO timestamp. */
  createdAt: string;
};

/** status is the HTTP status, or null when the request never got an answer. */
export class StaffApiError extends Error {
  constructor(
    readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = "StaffApiError";
  }
}

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      cache: "no-store",
      headers: { "x-admin-token": token, ...init.headers },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new StaffApiError(null, `Can't reach the API at ${API_URL}.`);
  }
  if (!res.ok) throw new StaffApiError(res.status, `The API answered ${res.status}.`);
  return (await res.json()) as T;
}

/** Newest first. Omit status for every notification. */
export function listNotifications(token: string, status?: NotificationStatus, signal?: AbortSignal) {
  const query = status ? `?status=${status}` : "";
  return request<StaffNotification[]>(`/staff/notifications${query}`, token, { signal });
}

/** Returns the updated notification. */
export function acknowledgeNotification(token: string, id: string) {
  return request<StaffNotification>(`/staff/notifications/${encodeURIComponent(id)}/acknowledge`, token, {
    method: "POST",
  });
}

/* ---------- The stored token ----------
 * A tiny external store over localStorage, read with useSyncExternalStore so
 * the server render (no storage) and the first client render agree. Storage
 * can be unavailable (private mode, blocked site data): the token then lives
 * in memory for this page view. */

const TOKEN_KEY = "smile-desk:admin-token";
const listeners = new Set<() => void>();
let memoryToken: string | null | undefined;

export function readAdminToken(): string | null {
  if (memoryToken === undefined) {
    try {
      memoryToken = localStorage.getItem(TOKEN_KEY);
    } catch {
      memoryToken = null;
    }
  }
  return memoryToken;
}

export function writeAdminToken(token: string | null) {
  memoryToken = token;
  try {
    if (token === null) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Kept in memory only; see above.
  }
  listeners.forEach((notify) => notify());
}

/** Also hears sign-in and sign-out from other tabs (the storage event). */
export function subscribeAdminToken(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== TOKEN_KEY && event.key !== null) return;
    memoryToken = undefined;
    onChange();
  };
  listeners.add(onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}
