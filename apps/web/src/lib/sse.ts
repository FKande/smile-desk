/* A tiny Server-Sent Events frame parser. EventSource can only GET, and the
 * chat stream is a POST, so the client reads the body with fetch() and feeds
 * decoded text in here as it arrives. Network chunks are arbitrary: a frame,
 * a line, even a CRLF pair can be split across two of them, so the parser
 * buffers until a line is complete and a blank line ends the frame.
 *
 * Kept free of imports so node:test can load it directly (test/sse.test.mjs). */

export type SseFrame = {
  /** The `event:` field; "message" when the frame names none. */
  event: string;
  /** The `data:` lines, joined with "\n". */
  data: string;
};

export type SseParser = {
  /** Feed the next decoded chunk; returns the frames it completed. */
  push(chunk: string): SseFrame[];
  /** The stream ended: returns a final frame the server didn't terminate. */
  end(): SseFrame[];
};

export function createSseParser(): SseParser {
  let buffer = "";
  let event = "";
  let data: string[] = [];

  function dispatch(): SseFrame | null {
    const frame = data.length > 0 ? { event: event || "message", data: data.join("\n") } : null;
    event = "";
    data = [];
    return frame;
  }

  function readLine(line: string): SseFrame | null {
    if (line === "") return dispatch();
    if (line.startsWith(":")) return null; // comment / keep-alive
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
    // id and retry don't matter for a single request/response stream.
    return null;
  }

  function drain(final: boolean): SseFrame[] {
    const frames: SseFrame[] = [];
    for (;;) {
      const match = /\r\n|\r|\n/.exec(buffer);
      if (!match) break;
      // A lone CR at the very end may be the first half of a CRLF.
      if (!final && match[0] === "\r" && match.index === buffer.length - 1) break;
      const line = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      const frame = readLine(line);
      if (frame) frames.push(frame);
    }
    return frames;
  }

  return {
    push(chunk) {
      buffer += chunk;
      return drain(false);
    },
    end() {
      const frames = drain(true);
      // Lenient: a last frame without its blank line still counts.
      if (buffer) {
        readLine(buffer);
        buffer = "";
      }
      const last = dispatch();
      if (last) frames.push(last);
      return frames;
    },
  };
}
