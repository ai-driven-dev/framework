---
status: pending
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Instruction: Update the skill-authoring contract

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
plugins/aidd-context/skills/04-skill-generate/references/
└── ✏️ skill-authoring.md   # relax R3, add conditional-load + notation rules
```

## Tasks to do

### `1)` Relax the one-level reference rule

> References may nest so a step loads only what it needs.

1. Rewrite R3: references MAY sit in sub-folders (`references/<group>/`); a reference still never `@`-chains another reference.
2. State the load-locality rule: split a file from another ONLY when some execution path needs one without the other; co-loaded content stays one file.

### `2)` Add the notation rule

> Sanction terse notation and diagrams.

1. Add a rule: reference/action bodies use telegraphic notation (tables, `→` for linear chains, fragments), never at the cost of a load-bearing condition.
2. Add: use a Mermaid diagram only for branching logic, not for a linear chain.

### `3)` Define the router (SKILL.md) format

> A leaner, self-evident action format — no field to interpret.

1. Frontmatter: official keys only (`name`, `description`, `argument-hint`); forbid an invented `kind`-style flag.
2. Body: a tiny `# Title`, then the chaining shown as a one-line arrow schema for a pipeline (`a → b → c ↺`) or the line `Pick one per request.` for a menu; no separate flow prose.
3. Actions table columns `# | Action | Does`, `Does` verb-led and telegraphic; drop the restated intro sentence and the `Input` column (it lives in each action's `## Input`).
4. Move "read an action's file just before running it" to a standing contract rule, not repeated per skill.

### `4)` Reconcile the rest of the contract

> Keep R1-R13 coherent after the edits.

1. Re-read R13 (includes) against nested paths; adjust wording so an action cites a nested reference by its full `@<path>`.
2. Confirm no other rule contradicts nesting; renumber or note scope if needed.

## Test acceptance criteria

<!-- Each criterion is an observable behavior, not a command. -->

| Task | Acceptance criteria                                                                 |
| ---- | ----------------------------------------------------------------------------------- |
| 1    | R3 permits a `references/<group>/file.md` and still bans reference-to-reference `@`-chains. |
| 2    | The contract names the telegraphic-notation rule and the Mermaid-only-for-branching rule. |
| 3    | The router format is specified: tiny title, arrow-schema for a pipeline or "pick one" for a menu, verb-led `Does`, no intro sentence, no `Input` column, no invented frontmatter flag. |
| 4    | No rule in the contract contradicts nested references; R13 covers nested `@<path>` citation. |
