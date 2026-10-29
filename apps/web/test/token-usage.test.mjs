// Token-usage guard (no dependencies: node:test only).
//
// Keeps the three-tier token system honest by scanning apps/web/src:
//   (a) no --p-* primitive outside src/styles (the design-system catalog may show them)
//   (b) no raw colour literals in .ts/.tsx (layout.tsx's viewport themeColor excepted)
//   (c) no Tailwind default-palette classes and no dark: variant in .tsx
//   (d) tier-3 component tokens never point at a primitive (one sanctioned exception)
// Each violation is reported as path:line so it can be fixed directly.
//
// Run: npm test -w @smile-desk/web

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, relative, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(WEB, "src");

/** Files under src, as POSIX paths relative to apps/web (e.g. "src/app/page.tsx"). */
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return [".ts", ".tsx", ".css"].includes(extname(e.name)) ? [relative(WEB, full).split(sep).join("/")] : [];
  });
}

const files = walk(SRC).map((path) => ({ path, lines: readFileSync(join(WEB, path), "utf8").split(/\r?\n/) }));

const STYLES = "src/styles/";
const CATALOG = "src/app/design-system/";
/** Viewport themeColor has to be a literal colour: CSS variables don't reach <meta>. */
const COLOR_LITERAL_ALLOWLIST = new Set(["src/app/layout.tsx"]);
/** Tier-3 tokens allowed to reference a primitive directly, with the reason. */
const COMPONENT_PRIMITIVE_ALLOWLIST = new Map([["--switch-thumb", "the thumb is white in both schemes"]]);

/** Blank out comments while keeping line numbers, so documentation can mention tokens. */
function stripComments(text, ext) {
  const block = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  // Line comments only in TS; in CSS `//` appears in url()s. Skip `://` (URLs).
  return ext === ".css" ? block : block.replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function scan(rule, predicate, pattern) {
  const hits = [];
  for (const f of files) {
    if (!predicate(f.path)) continue;
    const lines = stripComments(f.lines.join("\n"), extname(f.path)).split("\n");
    lines.forEach((line, i) => {
      for (const m of line.matchAll(pattern)) hits.push(`${f.path}:${i + 1}  ${rule}  ${m[0].trim()}`);
    });
  }
  return hits;
}

const isTs = (p) => p.endsWith(".ts") || p.endsWith(".tsx");

test("(a) primitives (--p-*) are only referenced inside src/styles", () => {
  const hits = scan(
    "primitive outside src/styles",
    (p) => !p.startsWith(STYLES) && !p.startsWith(CATALOG),
    /--p-[\w-]+/g,
  );
  assert.deepEqual(hits, [], `\n${hits.join("\n")}`);
});

test("(b) no raw colour literals in .ts/.tsx", () => {
  const hits = scan(
    "raw colour literal",
    (p) => isTs(p) && !p.startsWith(CATALOG) && !COLOR_LITERAL_ALLOWLIST.has(p),
    /(?<![\w&/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/g,
  );
  assert.deepEqual(hits, [], `\n${hits.join("\n")}`);
});

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|mauve|olive|mist|taupe";
const UTILITIES =
  "bg|text|border|border-[xytrbl]|border-[se]|ring|ring-offset|outline|divide|fill|stroke|from|via|to|accent|caret|decoration|placeholder|shadow|inset-shadow|inset-ring";

test("(c) no Tailwind default-palette classes and no dark: variant in .tsx", () => {
  const palette = new RegExp(
    `(?<![\\w-])(?:${UTILITIES})-(?:${PALETTE})-(?:50|[1-9]00|950)(?:/\\d+)?(?![\\w-])|(?<![\\w-])(?:${UTILITIES})-(?:black|white)(?:/\\d+)?(?![\\w-])`,
    "g",
  );
  const hits = [
    ...scan("Tailwind palette class", (p) => p.endsWith(".tsx") || p.endsWith(".ts"), palette),
    ...scan("dark: variant (tokens already switch)", (p) => p.endsWith(".tsx"), /(?<![\w-])dark:[\w[\]()-]+/g),
  ];
  assert.deepEqual(hits, [], `\n${hits.join("\n")}`);
});

test("(d) component tokens (tier 3) never point at a primitive", () => {
  const f = files.find((x) => x.path === `${STYLES}components.css`);
  assert.ok(f, "components.css not found");
  const hits = [];
  stripComments(f.lines.join("\n"), ".css")
    .split("\n")
    .forEach((line, i) => {
      const decl = /^\s*(--[\w-]+)\s*:\s*(.*)$/.exec(line);
      if (!decl || !/--p-[\w-]+/.test(decl[2])) return;
      if (COMPONENT_PRIMITIVE_ALLOWLIST.has(decl[1])) return;
      hits.push(`${f.path}:${i + 1}  component token references a primitive  ${decl[1]}: ${decl[2].trim()}`);
    });
  assert.deepEqual(hits, [], `\n${hits.join("\n")}`);
});

test("guard: walked the source tree", () => {
  assert.ok(files.some((f) => f.path === "src/styles/semantic.css"));
  assert.ok(files.some((f) => f.path.endsWith(".tsx")));
});
