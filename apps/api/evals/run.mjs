#!/usr/bin/env node
// Real-model scenario evals. Talks to an already running API over HTTP; it
// starts nothing itself. See evals/README.md.
//
//   node evals/run.mjs                 all scenarios
//   node evals/run.mjs --only=1,4      a subset
//
// Env: EVAL_API_URL (default http://localhost:4300), ADMIN_TOKEN (default local-test).
// Exit code: 0 all passed, 1 a scenario failed, 2 the API was unreachable.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from './lib.mjs';
import { scenarios } from './scenarios.mjs';

const apiUrl = (process.env.EVAL_API_URL ?? 'http://localhost:4300').replace(/\/$/, '');
const adminToken = process.env.ADMIN_TOKEN ?? 'local-test';
const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice('--only='.length).split(',').map(Number);
const selected = only ? scenarios.filter((s) => only.includes(s.id)) : scenarios;

const client = createClient({ apiUrl, adminToken });
const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

async function play(scenario) {
  const state = { conversationId: undefined, replies: [], appointments: [], escalated: false, degraded: false, turns: [] };
  const seen = new Set();

  async function send(message) {
    const started = performance.now();
    const res = await client.chat(message, state.conversationId);
    const ms = performance.now() - started;
    state.conversationId = res.conversationId;
    state.replies.push(res.reply);
    state.escalated ||= res.escalated;
    state.degraded ||= res.degraded;
    for (const card of res.appointments ?? []) {
      const key = `${card.action}:${card.appointmentId}`;
      if (!seen.has(key)) {
        seen.add(key);
        state.appointments.push(card);
      }
    }
    state.turns.push({ patient: message, assistant: res.reply, cards: res.appointments ?? [], ms: Math.round(ms) });
    return ms;
  }

  let elapsed = 0;
  for (const turn of scenario.turns) elapsed += await send(turn);
  for (const followUp of scenario.followUps ?? []) {
    if (!scenario.done || scenario.done(state) || state.degraded) break;
    elapsed += await send(followUp);
  }

  const checks = [...(await scenario.assert(state, client))];
  // A canned fallback reply means the model never answered: never a pass.
  checks.push({ name: 'model answered (not degraded)', pass: !state.degraded, detail: '' });
  return { scenario, state, checks, ms: elapsed, pass: checks.every((c) => c.pass) };
}

async function main() {
  try {
    await client.health();
  } catch (error) {
    console.error(`Cannot reach the API at ${apiUrl}: ${error.message}\nStart it first; see evals/README.md.`);
    process.exit(2);
  }

  console.log(`Running ${selected.length} scenario(s) against ${apiUrl}\n`);
  const results = [];
  for (const scenario of selected) {
    process.stdout.write(`  #${scenario.id} ${scenario.name} … `);
    let result;
    try {
      result = await play(scenario);
    } catch (error) {
      result = { scenario, state: null, checks: [{ name: 'ran without error', pass: false, detail: error.message }], ms: 0, pass: false };
    }
    results.push(result);
    console.log(`${result.pass ? 'PASS' : 'FAIL'} (${seconds(result.ms)})`);
  }

  // ---------- Summary table ----------
  const rows = results.map((r) => [
    `#${r.scenario.id}`,
    r.scenario.name,
    r.pass ? 'PASS' : 'FAIL',
    String(r.state?.turns.length ?? 0),
    seconds(r.ms),
  ]);
  const header = ['#', 'Scenario', 'Result', 'Turns', 'Latency'];
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
  const line = (cells) => cells.map((cell, i) => cell.padEnd(widths[i])).join('  ');
  console.log(`\n${line(header)}\n${widths.map((w) => '-'.repeat(w)).join('  ')}`);
  for (const row of rows) console.log(line(row));

  const passed = results.filter((r) => r.pass).length;
  const totalMs = results.reduce((sum, r) => sum + r.ms, 0);
  const totalTurns = results.reduce((sum, r) => sum + (r.state?.turns.length ?? 0), 0);
  console.log(
    `\n${passed}/${results.length} passed · ${totalTurns} turns · total model time ${seconds(totalMs)}` +
      ` · avg ${seconds(totalTurns ? totalMs / totalTurns : 0)} per turn`,
  );

  // ---------- Failure details ----------
  for (const r of results.filter((x) => !x.pass)) {
    console.log(`\n#${r.scenario.id} ${r.scenario.name}`);
    for (const c of r.checks) console.log(`  ${c.pass ? '✓' : '✗'} ${c.name}${c.detail ? `: ${c.detail}` : ''}`);
    const last = r.state?.turns.at(-1);
    if (last) console.log(`  last reply: ${last.assistant.replace(/\s+/g, ' ').slice(0, 300)}`);
  }

  // ---------- Transcript file for debugging (gitignored) ----------
  const dir = join(dirname(fileURLToPath(import.meta.url)), 'results');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(
    file,
    JSON.stringify(
      results.map((r) => ({ id: r.scenario.id, name: r.scenario.name, pass: r.pass, ms: Math.round(r.ms), checks: r.checks, turns: r.state?.turns })),
      null,
      2,
    ),
  );
  console.log(`\nTranscripts: ${file}`);

  process.exit(passed === results.length ? 0 : 1);
}

await main();
