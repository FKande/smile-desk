// Streamed-text accumulation and plain-text rendering (src/lib/reply-text.ts).
//
// Run: npm test -w @smile-desk/web

import { test } from "node:test";
import assert from "node:assert/strict";
import { applyStreamEvent, emptyStream, streamedText, toBlocks, toSegments } from "../src/lib/reply-text.ts";

const run = (events) => streamedText(events.reduce(applyStreamEvent, emptyStream));
const delta = (text) => ({ type: "delta", text });

test("deltas append to the bubble", () => {
  assert.equal(run([delta("Let me "), delta("check.")]), "Let me check.");
});

test("a step keeps its text; the next step continues after a blank line", () => {
  assert.equal(
    run([delta("Let me check. "), { type: "step" }, delta("I have Tuesday.")]),
    "Let me check.\n\nI have Tuesday.",
  );
});

test("a step with no text after it adds no separator", () => {
  assert.equal(run([delta("Hello"), { type: "step" }]), "Hello");
  assert.equal(run([{ type: "step" }, delta("Hello")]), "Hello");
});

test("reset discards only the text since the last step", () => {
  assert.equal(
    run([delta("Kept."), { type: "step" }, delta("Half a sen"), { type: "reset" }, delta("A fresh start.")]),
    "Kept.\n\nA fresh start.",
  );
  assert.equal(run([delta("Gone"), { type: "reset" }, delta("Again")]), "Again");
});

test("paragraphs split on blank lines; single line breaks stay inside a paragraph", () => {
  assert.deepEqual(toBlocks("Hi there.\nHow can I help?\n\nI can book visits."), [
    { kind: "paragraph", lines: ["Hi there.", "How can I help?"] },
    { kind: "paragraph", lines: ["I can book visits."] },
  ]);
});

test("bullet lines become a list, even without a blank line around them", () => {
  assert.deepEqual(toBlocks("Here is what's open:\n• Tue, Nov 4 at 9:00 AM\n•Wed, Nov 5 at 1:00 PM\nDo any work?"), [
    { kind: "paragraph", lines: ["Here is what's open:"] },
    { kind: "list", items: ["Tue, Nov 4 at 9:00 AM", "Wed, Nov 5 at 1:00 PM"] },
    { kind: "paragraph", lines: ["Do any work?"] },
  ]);
});

test("hyphen and asterisk bullets are accepted; a leading negative number is not a bullet", () => {
  assert.deepEqual(toBlocks("- Cleaning\n* Checkup\n-5 degrees"), [
    { kind: "list", items: ["Cleaning", "Checkup"] },
    { kind: "paragraph", lines: ["-5 degrees"] },
  ]);
});

test("markup stays text", () => {
  assert.deepEqual(toBlocks("<b>hi</b>"), [{ kind: "paragraph", lines: ["<b>hi</b>"] }]);
});

test("CRLF and empty input", () => {
  assert.deepEqual(toBlocks("a\r\n\r\nb"), [
    { kind: "paragraph", lines: ["a"] },
    { kind: "paragraph", lines: ["b"] },
  ]);
  assert.deepEqual(toBlocks(""), []);
});

test("phone numbers become tel: segments", () => {
  assert.deepEqual(toSegments("Call (415) 555-0100 now."), [
    { kind: "text", text: "Call " },
    { kind: "phone", text: "(415) 555-0100", href: "tel:+14155550100" },
    { kind: "text", text: " now." },
  ]);
  assert.deepEqual(toSegments("No number"), [{ kind: "text", text: "No number" }]);
});
