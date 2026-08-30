# Mode: intake — A day's notes in, a batch of entries out

Take raw notes pasted from a phone, draft an entry for each line, confirm the
whole batch once, write once. Built for end-of-day dumps of ten to twenty lines,
where fifteen round trips would cost more than the translating.

> **Non-negotiables (from `AGENTS.md` and `_shared.md`):**
> - **One confirmation for the batch**, then one write, then one validate.
> - **Never change an existing graded answer** as a side effect. Collisions are
>   reported, never silently merged or overwritten.
> - **Append only.** No reordering or restyling neighbors.
> - **UTF-8 accents intact.**

## Input

A pasted block. Assume nothing about its formatting — it came off a phone.
Tolerate, and strip:

- bullets and dashes: `-`, `*`, `•`, `–`
- numbering: `1.`, `1)`, `(1)`
- timestamps and dates on their own line or leading a line
- blank lines, trailing whitespace, smart quotes
- a stray header the user typed (`Tuesday`, `italian notes`)

One phrase per line. A line that is only a date or header is a section marker —
drop it, don't translate it.

If the paste is a single line, this is just `translate`. Hand off rather than
building a batch of one.

## The Parenthetical Convention

**A trailing parenthetical is context, not part of the phrase.**

```
Evie, do you want your gummies? (iron supplement, not candy)
the good bowl (the ceramic one she likes)
he's being dramatic (about the cat, affectionate)
```

Strip it from `en` as written, use it to decide the translation, then **fold it
back into `en` as a short disambiguator** so the entry still explains itself in
six months:

```
en: "{name}, do you want your gummies? (iron supplement)"
```

Compress it. The user's note may ramble; `en` gets the few words that
disambiguate. The full reasoning goes in `note`.

**What a parenthetical constrains, precisely:** it fixes the **sense** — which
thing is being talked about. It does **not** dictate vocabulary. This distinction
is load-bearing and was learned the hard way.

Worked example: `gummies (iron supplement, not candy)`. The sense is
*supplement*. It is tempting to conclude that any candy-adjacent word is
therefore wrong and reach for `le vitamine`. That would be a mistake —
`gommose` and `caramelle gommose` are the standard Italian terms **for
supplement gummies**, used on iron supplement packaging. The parenthetical rules
out the wrong *referent*, not the attested vocabulary for the right one.

So: let the parenthetical pick the sense. Let **register** pick the wording.
`caramelle gommose` is packaging register; `le gommose` is what a parent says.
Both are correct Italian for the same object.

When a parenthetical names a domain you are not certain about — a product
category, a regional food, a piece of equipment — say so in the review table
rather than guessing at the idiomatic term. A flagged uncertainty costs one
question; a confidently wrong graded answer costs a month of drilling it.

## Pipeline

1. **Load.** Corpus, `config/prefs.yml`. Parse or stop.

2. **Split and clean.** One candidate per line, list markers stripped, section
   markers dropped. Show the count: `14 lines, 12 phrases.`

3. **Per line, resolve silently.** Do not narrate. For each:

   **a. Names → templates.** Scan for any string in `entities[].names[]`,
   case-insensitive. Found → replace with `{name}` in both `en` and `it`,
   declare the slot, default to that entity id, queue an `addressed_to` edge with
   `primary: false`. The user never types `{name}`.

   A name **not** in `entities[]` is a queued question, not an auto-created
   entity. Creating entities from a batch paste is how typos become permanent
   records.

   **b. Parenthetical → sense.** Per the convention above.

   **c. Register.** Inherit from the addressed entity when there is one — a
   phrase aimed at a child entity is child register unless the words say
   otherwise. Otherwise infer from the phrase.

   **d. Translate.** Full `translate` rules: 3–5 options, best first, no calques,
   regional forms offered but not graded by default.

   **e. Collision check.** Normalized `en` already in the corpus → do not draft a
   duplicate. Flag it for the review table with the existing graded answer.

4. **Queue questions.** Only genuinely ambiguous items. A question is worth
   asking when the answer changes the graded Italian:

   - an unknown name (who, and what type?)
   - a phrase whose sense is ambiguous with no parenthetical (`"the ring"`)
   - a collision needing a decision (new sense, or add alternates?)
   - a domain term you would otherwise be guessing at

   Not worth asking: register shading, which regional variant to include,
   anything answerable from `prefs.yml`. Decide those and note them.

5. **Review table.** Compact — the user is scanning fifteen rows, not reading
   prose. Alternates and notes are not shown here; they are in the draft and can
   be inspected after.

6. **Ask, then confirm.** Questions first, all at once. Then one approval for the
   batch.

   Accept partial approval: `"all but 3 and 7"`, `"skip the gummies one"`,
   `"2 should be the second option"`. Apply and re-show only what changed.

7. **Write once.** All approved entries, all edges, one append, one
   `node validate.mjs`. Nonzero exit → restore, report which entry broke it.

8. **Report the delta.** Counts and ids. Not the entries again.

## Review Table

```
14 lines · 12 phrases · 1 question

    EN                                      IT (graded)
 1  {name}, do you want your gummies?       {name}, vuoi le gommose?
    (iron supplement)
 2  wheelbarrow                             — already filed as tr_wheelbarrow
 3  the good bowl (ceramic one)             la ciotola bella
 4  he's being dramatic (about the cat)     fa il drammatico
 …

Q1  Line 8 mentions "Nonna Pia" — not in entities. Person? What should
    it_name be?

Filing 11 entries, skipping 1 collision. OK?
```

## Anti-Patterns

- Don't confirm line by line. The whole point is one round trip.
- Don't auto-create entities from a paste. Ask.
- Don't overwrite a collision. Report it and move on.
- Don't ask about anything `prefs.yml` already answers.
- Don't narrate progress through the batch. Silence until the table.
- Don't expand a parenthetical into `en` verbatim. Compress to the disambiguator.
- Don't let a parenthetical veto attested vocabulary. It fixes the sense; register
  picks the words.
