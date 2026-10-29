import { parseTranscript } from "./chat-turns";
import { createSseParser, type SseFrame } from "./sse";

/* Everything the patient chat needs from the API, in one place.
 * POST /chat/stream is the main path; if a server doesn't have it yet (a
 * route-level 404) the turn falls back to the non-streaming POST /chat, which
 * returns the same final payload. */

export const MAX_MESSAGE_LENGTH = 2000;

export type AppointmentAction = "booked" | "rescheduled" | "cancelled";

export type AppointmentSummary = {
  action: AppointmentAction;
  appointmentId: string;
  patientName: string;
  /** "Cleaning" | "General checkup" | "Emergency visit". */
  typeLabel: string;
  /** Practice-local start: "Tue, Nov 4 at 9:30 AM". */
  label: string;
  providerName: string;
  status: string;
  /** The patient's reason, when the server shares it (emergency summary). */
  reason?: string | null;
  /** Visit length; older servers leave it out. */
  durationMinutes?: number;
};

export type ChatReply = {
  conversationId: string;
  reply: string;
  appointments: AppointmentSummary[];
  /** Staff were alerted during this conversation (emergency or hand-off). */
  escalated: boolean;
  /** The model was unreachable and a safe fallback reply was sent instead. */
  degraded: boolean;
};

/** One bubble of restored history. Assistant entries that ended a turn also
 *  carry what that turn showed; older servers send text only. */
export type TranscriptMessage =
  | { role: "patient"; text: string }
  | ({ role: "assistant"; text: string; at?: string } & Partial<
      Pick<ChatReply, "appointments" | "escalated" | "degraded">
    >);

export type StreamEvent =
  | { type: "start"; conversationId: string }
  | { type: "delta"; text: string }
  | { type: "reset" }
  | { type: "step" }
  | { type: "tool"; name: string; label: string };

export type ChatErrorKind = "network" | "rate_limited" | "not_found" | "invalid_input" | "server";

/** Anything that stops a turn. `kind` drives what the patient is told. */
export class ChatError extends Error {
  constructor(
    readonly kind: ChatErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ChatError";
  }
}

/* ---------- Base URL ---------- */

/** `?mock=1` points the page at the dev-only mock under /api/mock-chat, so
 *  the UI can be exercised without the API or a model key. */
export function isMockMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("mock") === "1";
}

function apiBase(): string {
  if (isMockMode()) return "/api/mock-chat";
  return (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/+$/, "");
}

/* ---------- Requests ---------- */

async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, init);
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new ChatError("network", "Could not reach the server.");
  }
  if (!response.ok) throw await toChatError(response);
  return response;
}

async function toChatError(response: Response): Promise<ChatError> {
  const body = (await response.json().catch(() => null)) as { error?: unknown; message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message : `Request failed (${response.status}).`;
  if (response.status === 429) return new ChatError("rate_limited", message, 429);
  // Only the API's own not_found means "that conversation is gone"; a bare
  // framework 404 means the route itself is missing.
  if (response.status === 404) {
    return new ChatError(body?.error === "not_found" ? "not_found" : "server", message, 404);
  }
  if (response.status === 400) return new ChatError("invalid_input", message, 400);
  return new ChatError("server", message, response.status);
}

const json = (body: unknown, accept = "application/json"): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json", accept },
  body: JSON.stringify(body),
});

export type SendOptions = {
  conversationId?: string;
  message: string;
  signal?: AbortSignal;
  onEvent?: (event: StreamEvent) => void;
};

/** One turn: streams events to onEvent and resolves with the final reply. */
export async function sendMessage({ conversationId, message, signal, onEvent }: SendOptions): Promise<ChatReply> {
  const body = { conversationId, message };
  let response: Response;
  try {
    response = await request("/chat/stream", { ...json(body, "text/event-stream"), signal });
  } catch (error) {
    // The stream route isn't deployed on this server: same turn, no stream.
    if (error instanceof ChatError && error.status === 404 && error.kind !== "not_found") {
      const fallback = await request("/chat", { ...json(body), signal });
      return (await fallback.json()) as ChatReply;
    }
    throw error;
  }

  if (!response.headers.get("content-type")?.includes("text/event-stream") || !response.body) {
    return (await response.json()) as ChatReply;
  }
  return readStream(response.body, onEvent);
}

async function readStream(
  body: ReadableStream<Uint8Array>,
  onEvent?: (event: StreamEvent) => void,
): Promise<ChatReply> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();

  // Returns the reply on `done`; throws on `error`.
  function handle(frame: SseFrame): ChatReply | undefined {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(frame.data) as Record<string, unknown>;
    } catch {
      return undefined; // a malformed frame is skipped, not fatal
    }
    const text = (key: string) => (typeof data[key] === "string" ? (data[key] as string) : "");
    switch (frame.event) {
      case "start":
        onEvent?.({ type: "start", conversationId: text("conversationId") });
        return undefined;
      case "delta":
        onEvent?.({ type: "delta", text: text("text") });
        return undefined;
      case "reset":
      case "step":
        onEvent?.({ type: frame.event });
        return undefined;
      case "tool":
        onEvent?.({ type: "tool", name: text("name"), label: text("label") });
        return undefined;
      case "done":
        return data as unknown as ChatReply;
      case "error":
        throw new ChatError("server", text("message") || "The reply could not be finished.");
      default:
        return undefined;
    }
  }

  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        throw new ChatError("network", "The connection dropped mid-reply.");
      }
      // stream: true holds back a multi-byte character split across chunks.
      const frames = chunk.done
        ? [...parser.push(decoder.decode()), ...parser.end()]
        : parser.push(decoder.decode(chunk.value, { stream: true }));
      for (const frame of frames) {
        const reply = handle(frame);
        if (reply) return reply;
      }
      if (chunk.done) throw new ChatError("network", "The reply ended early.");
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

export async function fetchTranscript(conversationId: string, signal?: AbortSignal): Promise<TranscriptMessage[]> {
  const response = await request(`/chat/${encodeURIComponent(conversationId)}/messages`, { signal });
  return parseTranscript(await response.json());
}

export async function sendFeedback(conversationId: string, rating: 1 | -1, comment?: string): Promise<void> {
  await request(
    `/chat/${encodeURIComponent(conversationId)}/feedback`,
    json({ rating, comment: comment || undefined }),
  );
}

/* ---------- Conversation id storage ---------- */

/* Mock conversations get their own key so they never collide with real ones. */
const storageKey = () => (isMockMode() ? "smile-desk:conversation:mock" : "smile-desk:conversation");

export function loadConversationId(): string | null {
  try {
    return localStorage.getItem(storageKey());
  } catch {
    return null; // storage blocked: the chat still works for this page view
  }
}

export function saveConversationId(id: string | null) {
  try {
    if (id) localStorage.setItem(storageKey(), id);
    else localStorage.removeItem(storageKey());
  } catch {
    // Storage blocked; the id lives in memory only.
  }
}
