---
status: pending
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Instruction: Router, description, docs, budget

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
plugins/aidd-context/skills/00-onboard/
├── ✏️ SKILL.md    # router: short description, action table (scan|present|run), refs/assets, principles
└── ✏️ README.md   # human doc, tutorial framing
plugins/aidd-context/
└── ✏️ CATALOG.md  # auto-synced by the pre-commit hook
```

## Tasks to do

### `1)` Rewrite the router

> Lean SKILL.md; the only always-on cost is the description.

1. Description: verb-led, `Use when` triggers led by "onboard me", `Not for` clause; target <= ~65 tokens.
2. Body in the phase-1 router format: tiny `# Onboard` title, the pipeline schema `scan → assess → present → run ↺`, then the `# | Action | Does` table with verb-led telegraphic `Does`. No intro sentence, no `Input` column.
3. List the nested references and assets; transversal rules as principles only, no render detail; `argument-hint: scan | assess | present | run`.

### `2)` Update the human doc

1. README: reframe onboard as a guided tutorial (banner, state block, flow, walk-or-SDLC); it is not model-loaded, so no token budget applies.

### `3)` Verify the token budget and links

> Prove the economy, not assert it.

1. Measure: description tokens (always-on) and the model-loaded total; record the before/after delta against the noob-first checkpoint.
2. Run the markdown-link check across the skill; every nested `@<path>` resolves.

## Test acceptance criteria

<!-- Each criterion is an observable behavior, not a command. -->

| Task | Acceptance criteria                                                                     |
| ---- | --------------------------------------------------------------------------------------- |
| 1    | SKILL.md is a pure router in the phase-1 format (tiny title, `scan → assess → present → run ↺` schema, verb-led `Does`, no intro/`Input`); the description is <= ~65 tokens and leads triggers with "onboard me". |
| 2    | README describes the tutorial flow and names no token rule for itself.                    |
| 3    | The measured model-loaded total is recorded with its delta; the link check reports zero broken links. |
| regress | Cross-branch PR scoping, session ledger, state-aware foundations, plan-status hedge, tier default+override, framing line, warnings-carry-a-fix, recap reply, and return-to-onboard all still hold end-to-end. |
