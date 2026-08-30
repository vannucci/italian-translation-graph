# Mode: entity — Resolve a name, traverse the graph, return what's filed

Answer questions about people, pets, and places in the corpus by **reading the
data**, not by recalling the conversation. "What's my pet name for Reggie" is a
graph traversal, not a memory test.

> **Non-negotiables (from `AGENTS.md`):**
>
> - **Traverse, don't recall.** Load the file. Resolve through `names[]`. Follow
>   edges. If it isn't in the data, it isn't an answer.
> - **Confirm before write.** Creating or editing an entity is a write.
> - **One `primary: true` per `(entity, rel)` pair.** Promoting demotes.

## Input

`$mode` after `entity` is a name, an alias, or a question containing one.
Accept:

- a bare name (`"Reggie"`)
- a question (`"what's my pet name for the cat?"`)
- an alias that isn't the canonical name (`"Reginald"`, `"Ev"`)
- a request to list (`"who's in the file?"`)
- a correction (`"Evie is 3"`, `"Reggie is a tomcat"`)

## Pipeline

1. **Load.** Read `data/traduzioni_v2.json`. Parse or stop.

2. **Resolve the name.** Match case-insensitively against every string in each
   entity's `names[]` — not just the first one. Aliases are the whole reason
   `names[]` is an array. Also check `it_name`.
   - **No match, but a near one** (typo, diminutive, different capitalization) →
     propose the match, ask before assuming. `"Regie"` → `"Did you mean Reggie?"`
   - **No match at all** → say so plainly and offer to create the entity. Do not
     invent an entity to have something to answer with.
   - **Multiple matches** → list them with their `type` and let the user pick.

3. **Read the question's relation.** Map the phrasing to a `rel` in `rel_vocab`:

   | Phrasing                          | `rel`                        |
   | --------------------------------- | ---------------------------- |
   | "pet name for", "what do I call"  | `endearment`, `pet_name_for` |
   | "what do I say to", "phrases for" | `addressed_to`               |
   | "what's said about"               | `refers_to`                  |
   | "whose is", "belongs to"          | `belongs_to`                 |

   If the question doesn't name a relation ("tell me about Reggie"), return
   everything: the entity record plus every edge, grouped by `rel`.

4. **Follow the edges.** Filter `edges[]` where `from` matches the entity id and
   `rel` matches. Resolve each `to` against `entries[]`. **Primary first**, then
   the rest.

   A dangling edge — `to` pointing at an entry id that doesn't exist — is
   corruption. Report it; do not quietly skip it.

5. **Render templates.** If an entry has a `{name}` slot, fill it with the
   entity's `it_name` before displaying. Show the filled form, not the raw
   template. `"{name}, è ora della nanna"` displays as `"Evie, è ora della
nanna"`.

6. **Surface `_todo`.** If the entity carries a `_todo`, say so in one line at
   the end. That's the marker asking to be resolved.

## Output Format

```
**Reggie** — cat, black, old

endearment
→ **Buietto** (primary) — void boy
  Buchetto Nero · il mio Vuoto · Nullino · Signor Nulla
```

For an `addressed_to` set:

```
**Evie** — child (f)

addressed_to
→ **Evie, è ora della nanna** (primary) — it's time for bed
  Evie, ti scappa la pipì? — do you need to go potty?
  Evie, cosa ti è piaciuto di più oggi? — what was your favorite thing today?

_todo: age/relationship unconfirmed — child vs. pet splits pipì vs. bisogni.
```

Graded answers in bold. Alternates on the indented line, `·`-separated, not
bolded — they aren't what the quiz scores.

## Writes

Three kinds, all requiring confirmation.

**Create an entity.** Fill `type`, `names[]` (every alias offered), `traits[]`,
`it_name`. Most Italian keeps the English given name — set `it_name` to the same
string unless there's a real Italian form the user actually uses. Mark `_todo` if
type or gender is unclear.

**Add an alias.** Append to `names[]`. Cheap and almost always right — a missed
alias is a failed lookup later. When the user refers to an entity by a name not
in the array, offer to add it.

**Change the primary.** Set the new edge `primary: true` and the old one
`primary: false` in the same edit. Never leave two primaries on one
`(entity, rel)` pair, and never leave zero — if the user demotes the only
primary, ask which one takes its place.

## Anti-Patterns

- Don't answer from conversational memory. The file is the answer even when you
  remember filing it five minutes ago — because next session you won't.
- Don't create an entity to resolve a lookup. Missing is a valid answer.
- Don't merge two entities that share a name without asking. Two cats named
  Reggie is unusual; a cat and a nephew both called Reggie is not.
- Don't invent a `rel` to fit an unusual question. Map to the closest one in
  `rel_vocab`, or propose adding a new rel explicitly.
