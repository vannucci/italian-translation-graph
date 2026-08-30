#!/usr/bin/env node
/**
 * lookup.mjs — deterministic reads against data/traduzioni_v2.json
 *
 * No model, no network, no inference. The corpus already holds the finished
 * answer; this just finds it. Sub-millisecond on a corpus of any size you'll
 * plausibly build by hand.
 *
 *   node lookup.mjs wheelbarrow          exact, then substring
 *   node lookup.mjs "time for bed"       phrases work; quote them
 *   node lookup.mjs --entity Reginald    resolves aliases, follows edges
 *   node lookup.mjs --refs gummies       attested-usage citations for an entry
 *   node lookup.mjs --list               every en → it, one per line
 *   node lookup.mjs --list --plain       tab-separated, for piping
 *   node lookup.mjs --stats              counts
 *
 * Exit 0 = found. Exit 1 = not found or bad usage.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = process.env.TRADUZIONI_CORPUS
  ? resolve(process.env.TRADUZIONI_CORPUS)
  : join(HERE, 'data', 'traduzioni_v2.json');

// ── args ─────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const terms = argv.filter((a) => !a.startsWith('--'));
const plain = flags.has('--plain');

if (!flags.size && !terms.length) {
  console.error('usage: lookup.mjs <phrase> | --refs <phrase> | --entity <name> | --list | --stats');
  process.exit(1);
}

// ── load ─────────────────────────────────────────────────────────────────────

let d;
try {
  d = JSON.parse(readFileSync(CORPUS, 'utf8'));
} catch (e) {
  console.error(`cannot read corpus at ${CORPUS}\n  ${e.message}`);
  process.exit(1);
}

const { entries = [], entities = [], edges = [] } = d;

// ── normalization ────────────────────────────────────────────────────────────
// Matches _shared.md exactly: forgive whitespace and case, never accents,
// never articles. This is lookup only — grading lives elsewhere and is stricter.

const norm = (s) =>
  String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/, '');

// Strip a parenthetical sense marker: "chick (baby chicken)" → "chick"
const bare = (s) => norm(s).replace(/\s*\([^)]*\)\s*$/, '');

// ── indexes, built once ──────────────────────────────────────────────────────

const byEn = new Map();
for (const e of entries) {
  for (const k of new Set([norm(e.en), bare(e.en)])) {
    if (k && !byEn.has(k)) byEn.set(k, e);
  }
}

const entityById = new Map(entities.map((e) => [e.id, e]));
const entryById = new Map(entries.map((e) => [e.id, e]));

const byAlias = new Map();
for (const ent of entities) {
  for (const n of [...(ent.names ?? []), ent.it_name]) {
    const k = norm(n);
    if (k && !byAlias.has(k)) byAlias.set(k, ent);
  }
}

// ── rendering ────────────────────────────────────────────────────────────────

// Fill {name} with the default entity's it_name, per _shared.md.
function render(text, entry) {
  if (!text?.includes('{name}')) return text;
  const id = entry?.slots?.name?.default;
  const it = entityById.get(id)?.it_name ?? '…';
  return text.replaceAll('{name}', it);
}

function show(e) {
  if (plain) {
    console.log(`${e.en}\t${render(e.it, e)}`);
    return;
  }
  const g = e.gender ? ` (${e.gender})` : '';
  const r = e.register && e.register !== 'neutral' ? ` [${e.register}]` : '';
  console.log(`${render(e.it, e)}${g}${r}`);
  const alts = (e.alternates ?? []).map((a) => render(a, e));
  if (alts.length) console.log(`  ${alts.join(' · ')}`);
  if (e.note) console.log(`  — ${e.note}`);
  const n = (e.evidence ?? []).length;
  if (n) console.log(`  [${n} ref${n > 1 ? 's' : ''}]`);
}

// ── modes ────────────────────────────────────────────────────────────────────

if (flags.has('--stats')) {
  const todos = entities.filter((e) => e._todo).length;
  console.log(
    `${entities.length} entities · ${entries.length} entries · ${edges.length} edges` +
      (todos ? ` · ${todos} _todo` : '')
  );
  process.exit(0);
}

if (flags.has('--list')) {
  for (const e of [...entries].sort((a, b) => a.en.localeCompare(b.en))) {
    if (plain) console.log(`${e.en}\t${render(e.it, e)}`);
    else console.log(`${e.en.padEnd(42)} ${render(e.it, e)}`);
  }
  process.exit(0);
}

if (flags.has('--entity')) {
  const q = norm(terms.join(' '));
  const ent = byAlias.get(q);
  if (!ent) {
    console.error(`no entity matching "${terms.join(' ')}"`);
    const near = [...byAlias.keys()].filter((k) => k.startsWith(q.slice(0, 3)));
    if (near.length) console.error(`  did you mean: ${near.join(', ')}`);
    process.exit(1);
  }

  const traits = (ent.traits ?? []).join(', ');
  console.log(`${ent.names[0]} — ${[ent.type, traits].filter(Boolean).join(', ')}`);

  const mine = edges.filter((g) => g.from === ent.id);
  const rels = [...new Set(mine.map((g) => g.rel))];
  for (const rel of rels) {
    console.log(`\n${rel}`);
    const sorted = mine
      .filter((g) => g.rel === rel)
      .sort((a, b) => Number(b.primary) - Number(a.primary));
    for (const g of sorted) {
      const e = entryById.get(g.to);
      if (!e) {
        console.log(`  ! dangling edge â†’ ${g.to}`);
        continue;
      }
      const mark = g.primary ? ' (primary)' : '';
      console.log(`  ${render(e.it, e)}${mark}  — ${render(e.en, e)}`);
    }
  }
  if (ent._todo) console.log(`\n_todo: ${ent._todo}`);
  process.exit(0);
}

if (flags.has('--refs')) {
  const q = norm(terms.join(' '));
  const e = byEn.get(q) ?? byEn.get(bare(q)) ?? entries.find((x) => norm(x.en).includes(q));
  if (!e) { console.error(`not in corpus: "${terms.join(' ')}"`); process.exit(1); }
  const evs = e.evidence ?? [];
  if (!evs.length) { console.log(`${e.en} — no references filed`); process.exit(0); }
  console.log(`${e.en}`);
  for (const ev of evs) {
    console.log(`  ${ev.claim}`);
    console.log(`    ${ev.file}${ev.source ? `  (${ev.source}${ev.captured ? `, ${ev.captured}` : ''})` : ''}`);
  }
  process.exit(0);
}

// ── default: phrase lookup ───────────────────────────────────────────────────

const q = norm(terms.join(' '));

const exact = byEn.get(q) ?? byEn.get(bare(q));
if (exact) {
  show(exact);
  process.exit(0);
}

const partial = entries.filter(
  (e) => norm(e.en).includes(q) || q.includes(bare(e.en))
);

if (partial.length === 1) {
  show(partial[0]);
  process.exit(0);
}

if (partial.length > 1) {
  console.log(`${partial.length} matches:`);
  for (const e of partial) console.log(`  ${e.en.padEnd(38)} ${render(e.it, e)}`);
  process.exit(0);
}

console.error(`not in corpus: "${terms.join(' ')}"`);
console.error('  run /traduzioni translate to add it');
process.exit(1);
