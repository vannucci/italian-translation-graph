#!/usr/bin/env node
/**
 * validate.mjs — integrity checker for data/traduzioni_v2.json
 *
 * JSON has no foreign keys. This is the substitute. Run it after every write
 * and from a pre-commit hook.
 *
 *   node validate.mjs                      # default corpus path
 *   node validate.mjs path/to/corpus.json  # explicit
 *
 * Exit 0 = clean (warnings allowed). Exit 1 = errors found.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = process.argv[2]
  ? resolve(process.argv[2])
  : join(HERE, 'data', 'traduzioni_v2.json');

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// ── load ─────────────────────────────────────────────────────────────────────

let raw, d;
try {
  raw = readFileSync(CORPUS, 'utf8');
} catch (e) {
  console.error(`FATAL  cannot read ${CORPUS}\n       ${e.message}`);
  process.exit(1);
}
try {
  d = JSON.parse(raw);
} catch (e) {
  console.error(`FATAL  ${CORPUS} is not valid JSON\n       ${e.message}`);
  console.error('       Restore from git rather than rewriting by hand.');
  process.exit(1);
}

// ── encoding ─────────────────────────────────────────────────────────────────
// Mojibake: UTF-8 bytes decoded as Latin-1. Parses fine, reads as garbage.
const MOJIBAKE = /Ã[¨©¹ ¡²³Ã¬]|Â[°»«]/;
if (MOJIBAKE.test(raw)) {
  err('mojibake detected (Ã¨ / Ã¹ style) — file written through a broken pipe. ' +
      'Restore from git; do not hand-correct the visible characters.');
}
// \u00e8 escapes parse and grade correctly but destroy git-diff readability.
if (/\\u00[0-9a-f]{2}/i.test(raw)) {
  warn('unicode escapes present — write with ensure_ascii=False so accents ' +
       'stay readable in diffs');
}

// ── top level ────────────────────────────────────────────────────────────────

for (const k of ['entities', 'entries', 'edges', 'rel_vocab']) {
  if (!Array.isArray(d[k])) err(`top level: "${k}" missing or not an array`);
}
if (errors.length) { report(); process.exit(1); }

if (d.schema_version !== 2) warn(`schema_version is ${d.schema_version}, expected 2`);

const entities = d.entities;
const entries = d.entries;
const edges = d.edges;
const relVocab = new Set(d.rel_vocab);

// ── ids ──────────────────────────────────────────────────────────────────────

const entityIds = new Set();
const entryIds = new Set();

for (const [i, e] of entities.entries()) {
  const id = e.id;
  if (!id) { err(`entities[${i}]: missing id`); continue; }
  if (!id.startsWith('ent_')) err(`${id}: entity id must start with "ent_"`);
  if (entityIds.has(id)) err(`${id}: duplicate entity id`);
  entityIds.add(id);

  if (!Array.isArray(e.names) || e.names.length === 0)
    err(`${id}: names[] missing or empty — aliases are how lookup resolves`);
  if (!e.it_name) warn(`${id}: no it_name`);
  if (!e.type) warn(`${id}: no type`);
  if (e._todo) warn(`${id}: unresolved _todo — ${e._todo}`);
}

for (const [i, e] of entries.entries()) {
  const id = e.id;
  if (!id) { err(`entries[${i}]: missing id`); continue; }
  if (!id.startsWith('tr_')) err(`${id}: entry id must start with "tr_"`);
  if (/^tr_\d+$/.test(id))
    err(`${id}: sequential id — use a descriptive lemma (tr_wheelbarrow)`);
  if (entryIds.has(id)) err(`${id}: duplicate entry id`);
  entryIds.add(id);
}

// ── entries ──────────────────────────────────────────────────────────────────

const NOUNISH = new Set(['noun', 'noun_phrase']);
const POS = new Set(['noun', 'noun_phrase', 'verb', 'adjective', 'phrase', 'sentence']);
const REGISTERS = new Set(['neutral', 'child', 'affectionate', 'formal', 'vulgar']);
const ARTICLES = /^(il|lo|la|i|gli|le|l'|un|uno|una|un')\s|^l'/i;

const seenEn = new Map();

for (const e of entries) {
  const id = e.id ?? '(no id)';

  for (const f of ['en', 'it', 'pos', 'register']) {
    if (!e[f]) err(`${id}: "${f}" missing or empty`);
  }
  if (!('gender' in e)) err(`${id}: "gender" key required (use null for sentences)`);
  if (!Array.isArray(e.alternates)) err(`${id}: alternates[] missing or not an array`);
  if (typeof e.slots !== 'object' || e.slots === null) err(`${id}: slots{} missing`);

  if (e.pos && !POS.has(e.pos)) warn(`${id}: unusual pos "${e.pos}"`);

  if (e.register) {
    const parts = e.register.split('/').map((s) => s.trim());
    for (const p of parts)
      if (!REGISTERS.has(p)) warn(`${id}: unusual register "${p}"`);
  }

  // gender: required on nouns, null on sentences
  if (NOUNISH.has(e.pos)) {
    if (e.gender !== 'm' && e.gender !== 'f')
      err(`${id}: pos "${e.pos}" needs gender "m" or "f", got ${JSON.stringify(e.gender)}`);
    if (e.it && !ARTICLES.test(e.it))
      warn(`${id}: graded answer "${e.it}" has no article — the article carries the gender`);
  }
  if (e.pos === 'sentence' && e.gender !== null)
    warn(`${id}: sentences should have gender null, got ${JSON.stringify(e.gender)}`);

  // duplicate English
  if (e.en) {
    const key = e.en.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
    if (seenEn.has(key)) err(`${id}: duplicate "en" — already filed as ${seenEn.get(key)}`);
    else seenEn.set(key, id);
  }

  // templates
  const enSlot = /\{name\}/.test(e.en ?? '');
  const itSlot = /\{name\}/.test(e.it ?? '');
  const declared = e.slots && Object.prototype.hasOwnProperty.call(e.slots, 'name');

  if (enSlot !== itSlot)
    err(`${id}: {name} appears in ${enSlot ? 'en' : 'it'} but not the other`);
  if (enSlot && !declared) err(`${id}: uses {name} but slots{} does not declare it`);
  if (declared && !enSlot) err(`${id}: declares slot "name" but no {name} in en/it`);
  if (declared) {
    const def = e.slots.name?.default;
    if (!def) err(`${id}: slot "name" has no default entity`);
    else if (!entityIds.has(def)) err(`${id}: slot default "${def}" is not a known entity`);
  }

  // graded answer must not sit in alternates too
  if (e.it && Array.isArray(e.alternates) && e.alternates.includes(e.it))
    warn(`${id}: graded answer also listed in alternates[]`);

  if (Array.isArray(e.alternates) && new Set(e.alternates).size !== e.alternates.length)
    warn(`${id}: duplicate entries in alternates[]`);
}

// ── edges ────────────────────────────────────────────────────────────────────

const primaries = new Map();  // "entity|rel" -> [entry ids]
const pairs = new Map();      // "entity|rel" -> count
const seenEdge = new Set();

for (const [i, g] of edges.entries()) {
  const tag = `edges[${i}]`;
  if (!g.from || !g.to || !g.rel) { err(`${tag}: needs from, rel, and to`); continue; }

  if (!entityIds.has(g.from)) err(`${tag}: from "${g.from}" is not a known entity`);
  if (!entryIds.has(g.to)) err(`${tag}: to "${g.to}" is not a known entry — dangling`);
  if (!relVocab.has(g.rel))
    err(`${tag}: rel "${g.rel}" is not in rel_vocab — add it explicitly, don't free-type`);
  if (typeof g.primary !== 'boolean') err(`${tag}: "primary" must be true or false`);

  const dup = `${g.from}|${g.rel}|${g.to}`;
  if (seenEdge.has(dup)) err(`${tag}: duplicate edge ${dup}`);
  seenEdge.add(dup);

  const key = `${g.from}|${g.rel}`;
  pairs.set(key, (pairs.get(key) ?? 0) + 1);
  if (g.primary === true) primaries.set(key, [...(primaries.get(key) ?? []), g.to]);
}

for (const [key] of pairs) {
  const p = primaries.get(key) ?? [];
  const [ent, rel] = key.split('|');
  if (p.length === 0)
    err(`(${ent}, ${rel}): no primary edge — exactly one must be primary:true`);
  else if (p.length > 1)
    err(`(${ent}, ${rel}): ${p.length} primaries (${p.join(', ')}) — only one allowed`);
}

// ── orphans ──────────────────────────────────────────────────────────────────

for (const e of entities) {
  if (!edges.some((g) => g.from === e.id))
    warn(`${e.id}: entity has no edges — nothing references it`);
}

// ── report ───────────────────────────────────────────────────────────────────

function report() {
  for (const w of warnings) console.log(`WARN   ${w}`);
  for (const e of errors) console.log(`ERROR  ${e}`);
  const counts = `${entities?.length ?? 0} entities · ${entries?.length ?? 0} entries · ${edges?.length ?? 0} edges`;
  console.log(
    errors.length
      ? `\nFAIL   ${errors.length} error(s), ${warnings.length} warning(s) — ${counts}`
      : `\nOK     ${counts}${warnings.length ? ` · ${warnings.length} warning(s)` : ''}`
  );
}

report();
process.exit(errors.length ? 1 : 0);
