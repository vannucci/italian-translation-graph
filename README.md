# traduzioni

EN(US) → modern Italian translation engine, backed by a local corpus that feeds a
memorization tool.

Local-first. Everything runs on your machine against your files. No account, no
server, no API key. The corpus is a JSON file in git — which means `git diff`
shows you every time a graded answer changed, and that's most of the point.

## Layout

```
traduzioni/
  AGENTS.md                    # role, output style, data contract, schema
  README.md                    # this file
  validate.mjs                 # integrity checker — run after every write
  .claude/skills/traduzioni/
    SKILL.md                   # the router; invocation surface
  modes/
    _shared.md                 # write protocol, normalization, trap catalog
    translate.md               # EN phrase → 3–5 options → filed
    entity.md                  # "what's my pet name for X" — graph traversal
    quiz.md                    # drill; defines what "correct" means
  config/
    prefs.yml                  # region, grading strictness
  data/
    traduzioni_v2.json         # THE CORPUS — canonical
    quiz-log.jsonl             # derived drill history (gitignored)
  references/
    gummies__amazon-it__2026-08.png   # attested usage; the citation for tr_gummies
```

## Use

```
/traduzioni wheelbarrow              # bare input routes to translate
/traduzioni translate hay
/traduzioni entity Reggie            # resolves aliases, follows edges
/traduzioni quiz 10
/traduzioni quiz nouns
```

A worked example:

```
> /traduzioni wheelbarrow

**wheelbarrow** (f)
1. la carriola
2. la cariola — Tuscan/central
3. il carrettino a mano
4. la barella da cantiere

Filing `tr_wheelbarrow`, graded answer *la carriola*. OK?
```

Option 1 becomes `it` — the answer the quiz grades against. The rest become
`alternates[]`: shown during review, never scored.

## The two layers

The most important rule in the repo. System files and user files never overlap.

**User layer** — yours. Never auto-modified, never reformatted, never
"cleaned up":

- `data/traduzioni_v2.json`
- `config/prefs.yml`

**System layer** — the tool. Versioned, safe to rewrite:

- `AGENTS.md`, `modes/*.md`, `SKILL.md`, `validate.mjs`

**Derived layer** — disposable, regenerable, gitignored:

- `data/quiz-log.jsonl`, any deck or CSV export

Files are canonical; databases are derived. If you eventually add SQLite for
query speed, it gets rebuilt from the JSON and never becomes a second source of
truth. When a derived artifact and the corpus disagree, the corpus is right and
the artifact gets rebuilt.

## Schema (v2)

Three tables — `entities`, `entries`, `edges`. It's a relational shape: `edges`
is a join table.

**entities** (`ent_*`) — people, pets, places. `names[]` holds every alias,
because that's how lookup resolves; a missing alias is a failed lookup later.

**entries** (`tr_*`) — the translations. `it` is graded. `alternates[]` are not.

**edges** — `{from, rel, to, primary}`. `rel` must already exist in `rel_vocab`;
adding a new relation means adding it to the vocab explicitly in the same edit.
Exactly one `primary: true` per `(entity, rel)` pair.

Ids are descriptive lemmas, not counters — `tr_wheelbarrow`, not `tr_0007`.
Descriptive ids make edges readable and survive reordering. Sense collisions get
a suffix (`tr_chick_bird` vs `tr_chick_slang`), decided **when you file it**, not
after the collision.

## Validate

```
node validate.mjs
```

JSON has no foreign keys; this is the substitute. It catches duplicate ids,
dangling edges, rels outside `rel_vocab`, missing gender on nouns, undeclared
template slots, zero-or-multiple primaries, and mojibake. Exit 1 on error.

Wire it to a pre-commit hook:

```bash
echo 'node validate.mjs' > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

Warnings don't block. Two are expected on a healthy corpus: unresolved `_todo`
markers, and nickname-style entries with no article.

## Non-negotiables

- **Confirm before write.** Nothing reaches `data/` without your word.
- **Never silently change a graded answer.** It's what the drill scores against;
  changing it invalidates study history. Promotion is always deliberate.
- **Append, never rewrite.** Adding an entry doesn't reorder or restyle its
  neighbors. Drive-by edits are how a corpus diverges from the history you were
  relying on to review it.
- **Accents are content.** `più` ≠ `piu`, `è` ≠ `e`. Written UTF-8, unescaped,
  graded strictly.

## Regional note

Family is from Tuscany. Central Italian and Tuscan forms are welcome and often
preferred — offered as labeled options. But a regional form becomes the graded
answer only when explicitly chosen, so the corpus still travels.
