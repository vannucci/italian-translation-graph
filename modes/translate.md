# Mode: translate — EN(US) phrase → modern Italian, filed to the corpus

Take a short English phrase, return 3–5 idiomatic Italian options best-first,
and — after confirmation — append it to `data/traduzioni_v2.json`.

> **Non-negotiables (from `AGENTS.md`):**
>
> - **Confirm before write.** Show the entry, wait, then append.
> - **Never change an existing `it`.** Promotion is an explicit request only.
> - **Append, never rewrite.** No reordering or reformatting neighbors.
> - **UTF-8 accents intact.** `è`, `più`, `pipì`. Never escape, never strip.

## Input

`$mode` after `translate` is the phrase. Accept:

- a **single word** (`"wheelbarrow"`)
- a **noun + adjective** pair (`"black cat"`)
- a **short phrase or sentence** (`"it's time for bed"`)
- **several at once**, one per line — treat each as its own entry
- a phrase **containing a name** → this is a template, see Templates below

If no phrase was given, ask for one. Do not invent a phrase to demonstrate.

## Pipeline

1. **Load the corpus.** Read `data/traduzioni_v2.json`. Parse it. If it does not
   parse, stop and report — do not proceed and overwrite a broken file with a
   guess.

2. **Check for a collision.** Search existing `entries[].en` for the same or a
   near-identical phrase. If one exists, do not create a duplicate. Show the
   existing entry and ask whether to add alternates to it, replace the graded
   answer, or file a genuinely distinct sense as a new entry.

3. **Translate.** Produce 3–5 options, best first. Criteria, in priority order:
   - **Idiomatic over literal.** If Italian restructures the thought, restructure
     it. `"what was your favorite thing"` becomes `"cosa ti è piaciuto di più"`,
     not `"cosa favorita"`.
   - **Register match.** Child-directed English gets child-directed Italian
     (`nanna`, not `letto`). Affectionate English gets a diminutive, not a
     dictionary noun.
   - **Regional flavor as an option.** Include a Tuscan or central variant when a
     natural one exists, labeled. Never as the only option.
   - **Include the near-miss when instructive.** If a plausible-looking word is
     wrong (`fare i bisogni` for a child), list it and mark why.

4. **Check for traps.** Flag only real ones, one line max. Real traps:
   - The word means something else entirely (`Ombretto` = eyeshadow)
   - Dominant slang sense swamps the literal one (`pera` = heroin slang)
   - A near-synonym is a different thing (`paglia` = straw, not hay)
   - Register mismatch that would actually embarrass (`fare i bisogni` is vet
     phrasing applied to a child)

   Not traps: minor connotation drift, formality shading, regional variation.
   Those go in `note`, silently.

5. **Draft the entry.** Fill every field. See Entry Shape below.

6. **Preview and confirm.** Show the options to the user, and state in one line
   what will be filed — the id, the graded answer, and any `_todo`. Wait.

7. **Append.** Push onto `entries[]`. Add any edges. Re-parse the file to
   confirm it is still valid JSON. If it is not, restore and report.

8. **Report the delta only.** One line: what id was added, what the graded answer
   is. Never echo the file back.

## Entry Shape

```json
{
  "id": "tr_wheelbarrow",
  "en": "wheelbarrow",
  "it": "la carriola",
  "alternates": ["la cariola", "il carrettino a mano"],
  "pos": "noun",
  "register": "neutral",
  "gender": "f",
  "slots": {},
  "note": "cariola is the common Tuscan/central spelling-pronunciation."
}
```

Field rules:

- **`id`** — `tr_` + the English lemma, snake_case (`tr_wheelbarrow`,
  `tr_void_boy`). Not sequential numbers. Descriptive ids survive reordering and
  make edges readable. Collision? Suffix a disambiguator (`tr_chick_bird` vs
  `tr_chick_slang`).
- **`en`** — the phrase as given, lightly normalized. Disambiguate in parens when
  the English is ambiguous: `"chick (baby chicken)"`.
- **`it`** — the graded answer. Include the article for nouns (`la carriola`,
  not `carriola`) — the article carries the gender and that's half the point of
  drilling it.
- **`alternates[]`** — the other options shown. Not graded. Parenthetical labels
  are fine here (`"il fienile (hayloft)"`, `"...d'oggi? (toscano, parlato)"`).
- **`pos`** — `noun` | `noun_phrase` | `verb` | `adjective` | `phrase` |
  `sentence`.
- **`register`** — `neutral` | `child` | `affectionate` | `formal` | `vulgar`.
  Slashes allowed when genuinely both: `"affectionate / child"`.
- **`gender`** — `m` | `f` | `null`. Required on nouns and noun phrases. `null`
  on sentences. Never omit the key.
- **`region`** — optional. Add only when the graded answer itself is regional
  (`"central / Tuscan"`). Omit when only an alternate is.
- **`slots`** — `{}` unless it's a template.
- **`note`** — why this answer over the others, and what to avoid. Write it for
  someone reviewing the corpus in six months who does not remember the
  conversation. One to three sentences.

## Templates

Any phrase containing a name is a template.

- Put `{name}` in **both** `en` and `it`, at the position Italian wants it —
  which is usually the same as English for vocatives, but check.
- Declare it: `"slots": { "name": { "fills_with": "entity", "default": "ent_evie" } }`
- Add an edge from the entity: `{"from": "ent_evie", "rel": "addressed_to", "to": "tr_bedtime", "primary": false}`
- Only one edge per `(entity, rel)` pair carries `primary: true`. If you add a
  new primary, demote the old one in the same edit.

If the name is not yet an entity, create the entity first, in the same edit.
Include every alias you know (`["Evie", "Ev"]`). Mark `_todo` if type or gender
is unclear and say so in one line.

## Output Format

Terse. This shape:

```
**wheelbarrow** (f)
1. la carriola
2. la cariola — Tuscan/central
3. il carrettino a mano
4. la barella da cantiere

Trap: none.

Filing `tr_wheelbarrow`, graded answer *la carriola*. OK?
```

For multiple inputs, repeat the block per phrase, then one combined confirm line
at the end. Do not confirm each separately.

Register goes in the header when it drives the choice:

```
**void boy** (m, affectionate)
```

## Anti-Patterns

- Don't explain the grammar unless asked. The user reads Italian.
- Don't hedge with "this could also be" — rank and commit. Best guess first is
  the whole contract.
- Don't pad `alternates[]` to reach five. Three good ones beats five with filler.
- Don't offer a calque even as option five. Never a literal calque means never.
- Don't write to `data/` before confirmation, not even "to save a round trip."
