// SSE frame parser (src/lib/sse.ts). Node strips the TypeScript types on
// import, so the module is tested as shipped.
//
// Run: npm test -w @smile-desk/web

import { test } from "node:test";
import assert from "node:assert/strict";
import { createSseParser } from "../src/lib/sse.ts";

/** Feed chunks one by one, then end; collect every frame. */
function parseAll(chunks) {
  const parser = createSseParser();
  const frames = chunks.flatMap((chunk) => parser.push(chunk));
  return [...frames, ...parser.end()];
}

test("parses whole frames", () => {
  const frames = parseAll(['event: start\ndata: {"conversationId":"c1"}\n\nevent: delta\ndata: {"text":"Hi"}\n\n']);
  assert.deepEqual(frames, [
    { event: "start", data: '{"conversationId":"c1"}' },
    { event: "delta", data: '{"text":"Hi"}' },
  ]);
});

test("a frame split across chunks comes out once, when complete", () => {
  const parser = createSseParser();
  assert.deepEqual(parser.push("event: del"), []);
  assert.deepEqual(parser.push('ta\ndata: {"te'), []);
  assert.deepEqual(parser.push('xt":"Hel'), []);
  assert.deepEqual(parser.push('lo"}\n'), []);
  assert.deepEqual(parser.push("\n"), [{ event: "delta", data: '{"text":"Hello"}' }]);
});

test("every split point of a stream gives the same frames", () => {
  const stream = 'event: tool\r\ndata: {"label":"Checking open times"}\r\n\r\nevent: step\ndata: {}\n\n';
  const expected = [
    { event: "tool", data: '{"label":"Checking open times"}' },
    { event: "step", data: "{}" },
  ];
  for (let i = 0; i <= stream.length; i++) {
    assert.deepEqual(parseAll([stream.slice(0, i), stream.slice(i)]), expected, `split at ${i}`);
  }
});

test("one character at a time", () => {
  const stream = 'event: done\ndata: {"reply":"See you then."}\n\n';
  assert.deepEqual(parseAll([...stream]), [{ event: "done", data: '{"reply":"See you then."}' }]);
});

test("CR, LF and CRLF line endings", () => {
  assert.deepEqual(parseAll(["event: a\rdata: 1\r\revent: b\r\ndata: 2\r\n\r\nevent: c\ndata: 3\n\n"]), [
    { event: "a", data: "1" },
    { event: "b", data: "2" },
    { event: "c", data: "3" },
  ]);
});

test("multi-line data joins with newlines; only one leading space is stripped", () => {
  assert.deepEqual(parseAll(["data: line one\ndata:  indented\ndata:no space\n\n"]), [
    { event: "message", data: "line one\n indented\nno space" },
  ]);
});

test("comments, unknown fields and empty frames are ignored", () => {
  assert.deepEqual(parseAll([": keep-alive\n\nid: 7\nretry: 1000\n\nevent: ping\n\nevent: delta\ndata: x\n\n"]), [
    { event: "delta", data: "x" },
  ]);
});

test("a final frame without its blank line is still delivered on end", () => {
  assert.deepEqual(parseAll(['event: done\ndata: {"ok":true}']), [{ event: "done", data: '{"ok":true}' }]);
});

test("the event name resets between frames", () => {
  assert.deepEqual(parseAll(["event: tool\ndata: 1\n\ndata: 2\n\n"]), [
    { event: "tool", data: "1" },
    { event: "message", data: "2" },
  ]);
});
