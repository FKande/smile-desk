// Contrast guard for the token system (no dependencies: node:test only).
//
// Reads the three token tiers straight from src/styles, resolves every
// semantic/component token to an OKLCH primitive for BOTH colour schemes,
// converts to sRGB and checks WCAG 2.x contrast for every pairing the UI
// actually renders. Fix failures in semantic.css (or the ramps), not here.
// The printed table doubles as the contrast documentation.
//
// Run: npm test -w @smile-desk/web

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const STYLES = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "styles");
const read = (f) => readFileSync(join(STYLES, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

// ── CSS parsing ──────────────────────────────────────────────────────────

/** Split a stylesheet into { selector, decls: Map<--name, value> } blocks. */
function parseBlocks(css) {
  const blocks = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls = new Map();
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) decls.set(d[1], d[2].trim());
    blocks.push({ selector: m[1].trim().replace(/\s+/g, " "), decls });
  }
  return blocks;
}

/** Parse an opaque `oklch(L% C H)` into numbers; null for anything else. */
function parseOklch(value) {
  const m = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value);
  return m ? { L: Number(m[1]) / 100, C: Number(m[2]), H: Number(m[3]) } : null;
}

/** Split `light-dark(a, b)` at its top-level comma. */
function splitLightDark(value) {
  const inner = value.slice("light-dark(".length, -1);
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === "(") depth++;
    else if (inner[i] === ")") depth--;
    else if (inner[i] === "," && depth === 0) return [inner.slice(0, i).trim(), inner.slice(i + 1).trim()];
  }
  throw new Error(`Malformed light-dark(): ${value}`);
}

const primitives = new Map();
for (const b of parseBlocks(read("primitives.css"))) {
  for (const [name, value] of b.decls) {
    const c = parseOklch(value);
    if (c) primitives.set(name, c);
  }
}

const semanticBlocks = parseBlocks(read("semantic.css"));
const componentBlocks = parseBlocks(read("components.css"));
const findBlock = (blocks, selector) => blocks.find((b) => b.selector === selector)?.decls ?? new Map();

const semantic = findBlock(semanticBlocks, ":root, [data-theme]");
const components = findBlock(componentBlocks, ":root, [data-theme]");
const toneScopes = new Map(
  componentBlocks
    .map((b) => [/^\[data-tone="(\w+)"\]$/.exec(b.selector)?.[1], b.decls])
    .filter(([tone]) => tone),
);

/**
 * Resolve a token to an OKLCH colour for one scheme. `scope` (a tone block)
 * shadows the global declarations, as the cascade does.
 */
function resolve(name, scheme, scope = new Map(), seen = new Set()) {
  if (seen.has(name)) throw new Error(`Cycle resolving ${name}`);
  seen.add(name);
  if (primitives.has(name)) return primitives.get(name);
  const value = scope.get(name) ?? components.get(name) ?? semantic.get(name);
  if (value === undefined) throw new Error(`Unknown token ${name}`);
  return resolveValue(value, scheme, scope, seen, name);
}

function resolveValue(value, scheme, scope, seen, name) {
  if (value.startsWith("light-dark(")) {
    const [light, dark] = splitLightDark(value);
    return resolveValue(scheme === "light" ? light : dark, scheme, scope, seen, name);
  }
  const ref = /^var\((--[\w-]+)\)$/.exec(value);
  if (ref) return resolve(ref[1], scheme, scope, seen);
  const literal = parseOklch(value);
  if (literal) return literal;
  throw new Error(`Cannot resolve ${name}: ${value}`);
}

// ── Colour math ──────────────────────────────────────────────────────────
// OKLCH → OKLab → LMS → linear sRGB, matrices from Björn Ottosson,
// "A perceptual color space for image processing" (2020).

function oklchToLinearSrgb({ L, C, H }) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** WCAG relative luminance. Out-of-gamut channels are clipped to sRGB. */
function luminance(oklch) {
  const [r, g, b] = oklchToLinearSrgb(oklch).map((v) => Math.min(1, Math.max(0, v)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(c1, c2) {
  const [hi, lo] = [luminance(c1), luminance(c2)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// ── Sanity checks on the math and the parser ─────────────────────────────

const WHITE = { L: 1, C: 0, H: 0 };
const BLACK = { L: 0, C: 0, H: 0 };
const GREY_808080 = { L: 0.59987, C: 0, H: 0 }; // cbrt(0.21586), linear #808080

test("colour math: known reference values", () => {
  assert.ok(Math.abs(luminance(WHITE) - 1) < 1e-4, "oklch(100% 0 0) luminance ≈ 1");
  assert.equal(luminance(BLACK), 0);
  assert.ok(Math.abs(contrast(WHITE, BLACK) - 21) < 1e-3, "white vs black = 21:1");
  assert.ok(Math.abs(luminance(GREY_808080) - 0.21586) < 1e-3, "#808080 luminance");
  assert.ok(Math.abs(contrast(GREY_808080, WHITE) - 3.95) < 0.01, "#808080 on white = 3.95:1");
  // #ff0000 = oklch(62.796% 0.25768 29.234): luminance is the red coefficient.
  assert.ok(Math.abs(luminance({ L: 0.62796, C: 0.25768, H: 29.234 }) - 0.2126) < 2e-3, "sRGB red");
});

test("parser: found all three token tiers", () => {
  assert.ok(primitives.size >= 7 * 24 + 2, `primitives parsed: ${primitives.size}`);
  assert.ok(semantic.has("--fg-default") && semantic.has("--brand-solid"));
  assert.ok(components.has("--button-primary-bg"));
  assert.deepEqual(
    [...toneScopes.keys()].sort(),
    ["accent", "brand", "danger", "info", "neutral", "success", "warning"],
  );
});

// ── The pairs the UI renders ─────────────────────────────────────────────

const AA_TEXT = 4.5;
const AAA_TEXT = 7;
const NON_TEXT = 3; // WCAG 2.x SC 1.4.11 (UI components, focus indicators)

const pairs = [];
const add = (fg, bg, min, kind, scope) => pairs.push({ fg, bg, min, kind, scope });

// Text on page surfaces. fg-disabled is exempt (SC 1.4.3) and not checked.
const SURFACES = ["--bg-canvas", "--bg-surface", "--bg-subtle"];
for (const fg of ["--fg-default", "--fg-secondary", "--fg-muted", "--fg-link", "--brand-text"]) {
  for (const bg of SURFACES) add(fg, bg, AA_TEXT, "text");
}
add("--fg-default", "--bg-surface-raised", AA_TEXT, "text");
add("--fg-muted", "--bg-surface-raised", AA_TEXT, "text");

// Intents: on-* pairs on solid + hover, and -text on its own tints (Badge/Alert).
for (const i of ["brand", "accent", "success", "danger", "info", "warning"]) {
  add(`--fg-on-${i}`, `--${i}-solid`, AA_TEXT, "on-*");
  add(`--fg-on-${i}`, `--${i}-solid-hover`, AA_TEXT, "on-*");
  add(`--${i}-text`, `--${i}-subtle`, AA_TEXT, "intent");
  add(`--${i}-text`, `--${i}-element`, AA_TEXT, "intent");
}

// Tier-3 component pairings.
for (const [fg, bg] of [
  ["--chip-fg", "--chip-bg"],
  ["--chip-fg", "--chip-bg-hover"],
  ["--slot-fg", "--slot-bg"],
  ["--slot-fg", "--slot-bg-hover"],
  ["--slot-fg-selected", "--slot-bg-selected"],
  ["--bubble-patient-fg", "--bubble-patient-bg"],
  ["--bubble-assistant-fg", "--bubble-assistant-bg"],
  ["--bubble-system-fg", "--bg-canvas"],
  ["--toast-fg", "--toast-bg"],
  ["--button-primary-fg", "--button-primary-bg"],
  ["--button-primary-fg", "--button-primary-bg-hover"],
  ["--button-secondary-fg", "--button-secondary-bg"],
  ["--button-secondary-fg", "--button-secondary-bg-hover"],
  ["--button-ghost-fg", "--button-ghost-bg-hover"],
  ["--button-danger-fg", "--button-danger-bg"],
  ["--button-danger-fg", "--button-danger-bg-hover"],
  ["--input-fg", "--input-bg"],
  ["--input-placeholder", "--input-bg"],
  ["--avatar-assistant-fg", "--avatar-assistant-bg"],
  ["--avatar-patient-fg", "--avatar-patient-bg"],
]) {
  add(fg, bg, AA_TEXT, "component");
}

// Tone scopes, as Badge / Alert / AppointmentCard render them.
for (const tone of toneScopes.keys()) {
  add("--tone-text", "--tone-subtle", AA_TEXT, "tone", tone);
  add("--tone-on-solid", "--tone-solid", AA_TEXT, "tone", tone);
  add("--tone-on-solid", "--tone-solid-hover", AA_TEXT, "tone", tone);
}

// Non-text UI.
for (const bg of ["--bg-surface", "--bg-canvas"]) {
  add("--border-strong", bg, NON_TEXT, "non-text");
  add("--focus-ring", bg, NON_TEXT, "non-text");
  add("--focus-ring-danger", bg, NON_TEXT, "non-text");
  add("--brand-solid", bg, NON_TEXT, "non-text");
}
add("--input-border-invalid", "--input-bg", NON_TEXT, "non-text");
add("--check-fg-checked", "--check-bg-checked", NON_TEXT, "non-text");
add("--switch-thumb", "--switch-track-checked", NON_TEXT, "non-text");

// ── Evaluate, print, assert ──────────────────────────────────────────────

const SCHEMES = ["light", "dark"];
const results = pairs.map((p) => {
  const scope = p.scope ? toneScopes.get(p.scope) : new Map();
  const ratios = Object.fromEntries(
    SCHEMES.map((s) => [s, contrast(resolve(p.fg, s, scope), resolve(p.bg, s, scope))]),
  );
  return { ...p, ratios };
});

const label = (p) => `${p.scope ? `[${p.scope}] ` : ""}${p.fg} on ${p.bg}`;
const cell = (r, min) =>
  `${r.toFixed(2).padStart(5)}${min === AA_TEXT && r >= AAA_TEXT ? "*" : " "} ${r >= min ? "ok  " : "FAIL"}`;
const width = Math.max(...results.map((r) => label(r).length));
console.log(
  [
    "",
    "Token contrast (WCAG 2.x). * = text reaching AAA 7:1",
    `${"pair".padEnd(width)}  ${"kind".padEnd(9)}  min  light        dark`,
    ...results.map(
      (r) =>
        `${label(r).padEnd(width)}  ${r.kind.padEnd(9)}  ${r.min.toFixed(1)}  ${cell(r.ratios.light, r.min)}  ${cell(r.ratios.dark, r.min)}`,
    ),
    "",
  ].join("\n"),
);

for (const scheme of SCHEMES) {
  test(`contrast: every pair meets its minimum in ${scheme}`, () => {
    const failures = results
      .filter((r) => r.ratios[scheme] < r.min)
      .map((r) => `${label(r)}: ${r.ratios[scheme].toFixed(2)} < ${r.min}`);
    assert.deepEqual(failures, [], failures.join("\n"));
  });
}

test("contrast: body text (fg-default) reaches AAA 7:1 on every page surface", () => {
  const short = results
    .filter((r) => r.fg === "--fg-default" && r.kind === "text")
    .flatMap((r) => SCHEMES.filter((s) => r.ratios[s] < AAA_TEXT).map((s) => `${label(r)} (${s}): ${r.ratios[s].toFixed(2)}`));
  assert.deepEqual(short, [], short.join("\n"));
});
