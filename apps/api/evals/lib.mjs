// Shared helpers for the scenario evals: HTTP client, practice-time date
// parsing, and small assertion builders. Plain ESM, no build step.
import { DateTime } from 'luxon';

export const ZONE = 'America/Los_Angeles'; // must match PRACTICE.timezone in src/practice/practice.ts
export const now = () => DateTime.now().setZone(ZONE);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** HTTP client for one running API. Retries 429s (POST /chat allows 20/min per IP). */
export function createClient({ apiUrl, adminToken }) {
  async function request(path, init = {}, attempt = 0) {
    const response = await fetch(`${apiUrl}${path}`, init);
    if (response.status === 429 && attempt < 6) {
      const retryAfter = Number(response.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 10_000);
      return request(path, init, attempt + 1);
    }
    if (!response.ok) {
      throw new Error(`${init.method ?? 'GET'} ${path} → ${response.status} ${await response.text()}`);
    }
    return response.json();
  }

  return {
    chat: (message, conversationId) =>
      request('/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(conversationId ? { conversationId, message } : { message }),
      }),
    staffNotifications: () => request('/staff/notifications', { headers: { 'x-admin-token': adminToken } }),
    health: () => request('/health'),
  };
}

/**
 * Card labels come from formatSlotLabel ("Thu, Nov 13 at 4:30 PM", practice
 * time, no year). The year is inferred as the one that puts the date within
 * a few weeks back to ~11 months ahead of today.
 */
export function parseSlotLabel(label) {
  const base = now();
  for (const year of [base.year, base.year + 1, base.year - 1]) {
    const parsed = DateTime.fromFormat(`${label} ${year}`, "ccc, LLL d 'at' h:mm a yyyy", { zone: ZONE });
    if (parsed.isValid && parsed >= base.minus({ weeks: 4 }) && parsed <= base.plus({ months: 11 })) return parsed;
  }
  return null;
}

/** Monday 00:00 of next week, practice time (ISO weeks start on Monday). */
export const nextWeekStart = () => now().startOf('week').plus({ weeks: 1 });
export const nextMonthStart = () => now().startOf('month').plus({ months: 1 });

/** A check is { name, pass, detail }. */
export const check = (name, pass, detail = '') => ({ name, pass: Boolean(pass), detail });

export const cardsWith = (state, action) => state.appointments.filter((card) => card.action === action);

export const describeCards = (cards) =>
  cards.length ? cards.map((c) => `${c.action} ${c.typeLabel} for ${c.patientName}: ${c.label}`).join('; ') : 'no cards';
