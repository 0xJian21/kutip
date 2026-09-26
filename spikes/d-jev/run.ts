// Spike D: run the 6 sample replies through Jev and Haiku, print a comparison table.
// Usage (from repo root, after adding deps to spikes/package.json):
//   pnpm --filter @kutip/spikes exec tsx d-jev/run.ts
// Reads TYPESAFE_API_KEY and ANTHROPIC_API_KEY from the repo-root .env. Never prints them.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SAMPLES, type Label, type Result } from './samples';
import { classify as jev } from './jev';
import { classify as haiku } from './haiku';

const here = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.resolve(here, '../../.env'));
} catch {
  /* no .env: rely on the environment */
}
for (const k of ['TYPESAFE_API_KEY', 'ANTHROPIC_API_KEY']) {
  console.log(`${k}: ${process.env[k] ? 'set' : 'MISSING'}`);
}

type Row = Result | { error: string };
const safe = async (fn: (e: string) => Promise<Result>, email: string): Promise<Row> => {
  try {
    return await fn(email);
  } catch (e) {
    return { error: e instanceof Error ? `${e.constructor.name}: ${e.message.slice(0, 60)}` : String(e) };
  }
};

const ok = (r: Row, expected: Label | Label[]) =>
  'error' in r ? ' ' : (Array.isArray(expected) ? expected : [expected]).includes(r.label) ? '✓' : '✗';
const cell = (r: Row) =>
  'error' in r
    ? r.error
    : `${r.label.padEnd(16)} ${r.confidence.toFixed(2)} ${String(Math.round(r.latencyMs)).padStart(5)}ms $${r.costUsd.toFixed(6)}`;

const rows: { id: number; expected: string; jev: Row; haiku: Row }[] = [];
const totals = { jev: { ms: 0, usd: 0, hit: 0 }, haiku: { ms: 0, usd: 0, hit: 0 } };

for (const s of SAMPLES) {
  const [j, h] = await Promise.all([safe(jev, s.email), safe(haiku, s.email)]);
  rows.push({ id: s.id, expected: [s.expected].flat().join('|'), jev: j, haiku: h });
  for (const [k, r] of [['jev', j], ['haiku', h]] as const) {
    if ('error' in r) continue;
    totals[k].ms += r.latencyMs;
    totals[k].usd += r.costUsd;
    if ([s.expected].flat().includes(r.label)) totals[k].hit += 1;
  }
}

console.log('');
console.log(`#  expected                 | jev  label            conf  latency cost       | haiku label            conf  latency cost`);
console.log('-'.repeat(120));
for (const r of rows) {
  const exp = SAMPLES.find((s) => s.id === r.id)!.expected;
  console.log(
    `${r.id}  ${r.expected.padEnd(24)} | ${ok(r.jev, exp)} ${cell(r.jev).padEnd(44)} | ${ok(r.haiku, exp)} ${cell(r.haiku)}`,
  );
}
console.log('-'.repeat(120));
const n = SAMPLES.length;
console.log(
  `totals                      | jev   ${totals.jev.hit}/${n} correct  ${Math.round(totals.jev.ms)}ms  $${totals.jev.usd.toFixed(6)}` +
    `   | haiku ${totals.haiku.hit}/${n} correct  ${Math.round(totals.haiku.ms)}ms  $${totals.haiku.usd.toFixed(6)}`,
);

// Adversarial sample: show what each model returned so leakage (or lack of it) is visible.
const adv = rows.find((r) => r.id === 6)!;
console.log('\nAdversarial (#6) raw:');
console.log('  jev  :', JSON.stringify('error' in adv.jev ? adv.jev : adv.jev.raw));
console.log('  haiku:', JSON.stringify('error' in adv.haiku ? adv.haiku : adv.haiku.raw));
