/* Client for the office team's views (apps/api: StaffController and
 * FeedbackController). The staff routes are open in this demo; production
 * would put them behind staff sign-in. */

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

export type FeedbackRating = 1 | -1;

/** One patient rating of a conversation (apps/api: FeedbackService). */
export type FeedbackEntry = {
  id: string;
  conversationId: string;
  rating: FeedbackRating;
  comment: string | null;
  /** UTC ISO timestamp. */
  createdAt: string;
  /** Null unless the patient verified their identity in that chat. */
  patientName: string | null;
  /** The patient's first message, trimmed to about 140 characters. */
  excerpt: string;
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, cache: "no-store" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new StaffApiError(null, `Can't reach the API at ${API_URL}.`);
  }
  if (!res.ok) throw new StaffApiError(res.status, `The API answered ${res.status}.`);
  return (await res.json()) as T;
}

/** Newest first. Omit status for every notification. */
export function listNotifications(status?: NotificationStatus, signal?: AbortSignal) {
  const query = status ? `?status=${status}` : "";
  return request<StaffNotification[]>(`/staff/notifications${query}`, { signal });
}

/** Returns the updated notification. */
export function acknowledgeNotification(id: string) {
  return request<StaffNotification>(`/staff/notifications/${encodeURIComponent(id)}/acknowledge`, {
    method: "POST",
  });
}

/** The 50 most recent ratings, newest first. Omit rating for both kinds. */
export function listFeedback(rating?: FeedbackRating, signal?: AbortSignal) {
  const query = rating ? `?rating=${rating}` : "";
  return request<FeedbackEntry[]>(`/staff/feedback${query}`, { signal });
}
