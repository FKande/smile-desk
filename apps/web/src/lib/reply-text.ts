/* Pure helpers for the assistant's text: how streamed deltas add up to the
 * bubble's text, and how Maya's plain text (paragraphs, "•" option lines)
 * becomes blocks to render. No imports, so node:test loads it directly
 * (test/reply-text.test.mjs). */

/* ---------- Streaming ---------- */

/** The reply as it streams. `kept` is text from finished model steps; `step`
 *  is the text of the step in progress, which a `reset` may still discard. */
export type StreamText = { kept: string; step: string };

export const emptyStream: StreamText = { kept: "", step: "" };

export type StreamTextEvent = { type: "delta"; text: string } | { type: "step" } | { type: "reset" };

export function applyStreamEvent(state: StreamText, event: StreamTextEvent): StreamText {
  switch (event.type) {
    case "delta":
      return { ...state, step: state.step + event.text };
    case "step":
      // The step is final; later deltas continue the same bubble.
      return { kept: joinSteps(state.kept, state.step), step: "" };
    case "reset":
      // The server switched providers mid-step: that step starts over.
      return { ...state, step: "" };
  }
}

/** What the bubble shows: finished steps and the current one, a blank line apart. */
export function streamedText(state: StreamText): string {
  return joinSteps(state.kept, state.step);
}

function joinSteps(a: string, b: string) {
  const left = a.trimEnd();
  const right = b.trimStart();
  return left && right ? `${left}\n\n${right}` : left || right;
}

/* ---------- Rendering ---------- */

export type TextBlock = { kind: "paragraph"; lines: string[] } | { kind: "list"; items: string[] };

/* "•" is what Maya is told to use; "-", "*" and "–" are accepted because
 * models drift. A hyphen needs a space after it so "-5" stays a number. */
const BULLET = /^\s*(?:[•●▪◦‣–]\s*|[-*]\s+)/;

/**
 * Plain text → blocks. Blank lines separate paragraphs; consecutive bullet
 * lines form a list (a list also ends a paragraph without a blank line).
 * Output is plain strings: the caller renders them as text, never as HTML.
 */
export function toBlocks(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  let current: TextBlock | null = null;

  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      current = null;
      continue;
    }
    const bullet = BULLET.exec(raw);
    if (bullet) {
      const item = raw.slice(bullet[0].length).trim();
      if (!item) continue;
      if (current?.kind !== "list") blocks.push((current = { kind: "list", items: [] }));
      current.items.push(item);
    } else {
      if (current?.kind !== "paragraph") blocks.push((current = { kind: "paragraph", lines: [] }));
      current.lines.push(line);
    }
  }
  return blocks;
}

export type TextSegment = { kind: "text"; text: string } | { kind: "phone"; text: string; href: string };

const PHONE = /\(\d{3}\)\s?\d{3}-\d{4}/g;

/** Splits out US phone numbers ("(415) 555-0100") so they render as tel: links. */
export function toSegments(line: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of line.matchAll(PHONE)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ kind: "text", text: line.slice(last, start) });
    segments.push({ kind: "phone", text: match[0], href: `tel:+1${match[0].replace(/\D/g, "")}` });
    last = start + match[0].length;
  }
  if (last < line.length) segments.push({ kind: "text", text: line.slice(last) });
  return segments;
}
