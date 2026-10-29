// Turn attachments and restored history (src/lib/chat-turns.ts).
//
// Run: npm test -w @smile-desk/web

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTranscript, restoreThread, turnAttachments } from "../src/lib/chat-turns.ts";

const card = (overrides = {}) => ({
  action: "booked",
  appointmentId: "appt_1",
  patientName: "Sarah Johnson",
  typeLabel: "Cleaning",
  label: "Tue, Nov 4 at 9:00 AM",
  providerName: "Dana Lee, RDH",
  status: "booked",
  ...overrides,
});
const emergencyCard = (reason) => card({ typeLabel: "Emergency visit", reason, durationMinutes: 30 });
const timeOf = () => "9:41 AM";
const opts = { alreadyEscalated: false, patientTexts: [], notifiedAt: "9:41 AM" };

test("the emergency notice uses the server's reason", () => {
  const out = turnAttachments(
    { appointments: [emergencyCard("Cracked molar")], escalated: true },
    { ...opts, patientTexts: ["I cracked a molar and it throbs all night", "yes"] },
  );
  assert.deepEqual(out.emergency, { summary: "Cracked molar", notifiedAt: "9:41 AM" });
  assert.equal(out.staffNotified, false, "the emergency notice already says staff know");
});

test("with no reason, the longest of the last four patient messages stands in", () => {
  const texts = ["an old, very long message that is out of the window", "my tooth broke", "it hurts a lot today", "ok", "2pm"];
  const out = turnAttachments({ appointments: [emergencyCard(null)], escalated: true }, { ...opts, patientTexts: texts });
  assert.equal(out.emergency?.summary, "it hurts a lot today");
});

test("a cancelled emergency visit shows no emergency notice", () => {
  const out = turnAttachments({ appointments: [{ ...emergencyCard("x"), action: "cancelled" }] }, opts);
  assert.equal(out.emergency, undefined);
});

test("the staff notice shows only when escalation first becomes true", () => {
  assert.equal(turnAttachments({ escalated: true }, opts).staffNotified, true);
  assert.equal(turnAttachments({ escalated: true }, { ...opts, alreadyEscalated: true }).staffNotified, false);
  assert.equal(turnAttachments({ escalated: true, degraded: true }, opts).staffNotified, false);
});

test("restoring history re-renders each turn's cards and notices, staff once", () => {
  const { messages, escalated } = restoreThread(
    [
      { role: "patient", text: "can someone call me?" },
      { role: "assistant", text: "Done.", appointments: [], escalated: true, degraded: false, at: "2026-10-29T16:41:00Z" },
      { role: "patient", text: "and book a cleaning" },
      { role: "assistant", text: "Booked.", appointments: [card()], escalated: true, degraded: false },
    ],
    timeOf,
  );
  assert.equal(escalated, true);
  const [, first, , second] = messages;
  assert.equal(first.staffNotified, true);
  assert.equal(first.at?.toISOString(), "2026-10-29T16:41:00.000Z");
  assert.equal(second.staffNotified, false);
  assert.equal(second.appointments.length, 1);
});

test("restoring an emergency turn shows its notice with the stored time", () => {
  const { messages } = restoreThread(
    [
      { role: "patient", text: "I cracked a tooth" },
      { role: "assistant", text: "Booked.", appointments: [emergencyCard("Cracked molar")], escalated: true, at: "2026-10-29T16:41:00Z" },
    ],
    timeOf,
  );
  assert.deepEqual(messages[1].emergency, { summary: "Cracked molar", notifiedAt: "9:41 AM" });
  assert.equal(messages[1].staffNotified, false);
});

test("text-only history from an older server restores as plain bubbles", () => {
  const { messages, escalated } = restoreThread(parseTranscript([{ role: "patient", text: "hi" }, { role: "assistant", text: "Hello!" }]), timeOf);
  assert.equal(escalated, false);
  assert.deepEqual(messages[1], { role: "assistant", text: "Hello!", at: undefined, appointments: [], staffNotified: false, emergency: undefined, degraded: false });
});

test("parsing keeps valid fields and drops malformed ones", () => {
  const parsed = parseTranscript([
    { role: "patient", text: "hi", escalated: true },
    { role: "assistant", text: "Booked.", appointments: [card({ durationMinutes: 60, reason: "x" }), { action: "booked" }], escalated: "yes", degraded: false },
    { role: "system", text: "nope" },
    { role: "assistant" },
    null,
  ]);
  assert.deepEqual(parsed, [
    { role: "patient", text: "hi" },
    { role: "assistant", text: "Booked.", appointments: [card({ durationMinutes: 60, reason: "x" })], degraded: false },
  ]);
  assert.deepEqual(parseTranscript({ not: "an array" }), []);
});
