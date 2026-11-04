---
status: pending
---

# Instruction: Measure after, document, ship

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── aidd_docs/
│   ├── README.md ✏️
│   └── tasks/2026_11/2026_11_04_lean-project-memory/
│       └── measure.md ✏️
└── docs/
    ├── CONCEPTS.md ✏️
    └── GUIDES.md ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | the harness of phase 1, the skill at the final head | same cases, same models | system |
| Happy path | rerun and grade blind | after rows beside the before rows | system |
| Edge case | a model writes more wrong facts or costs more than before | the phase stays open and the cause is named | system |

## Tasks to do

### `1)` Measure

> The issue's criteria, answered with numbers.

1. Rerun phase 1's cases and grading on the final skill, Haiku first and Qwen 3.8 Flash once Haiku passes; add the after rows to `measure.md`.
2. Count the skill's total words against phase 1's number.
3. Check each acceptance criterion of #1141 against them.

### `2)` Documents

> What the docs say matches what the skill does.

1. Add the format check at each write to `docs/CONCEPTS.md`, and update `docs/GUIDES.md` where it describes what setup writes and what check returns.
2. Update this repository's `aidd_docs/README.md` lines that say the skill scaffolds `aidd_docs/`.

### `3)` Gates

> Nothing regresses.

1. Run `pnpm exec lefthook run pre-commit --all-files` and `pnpm exec lefthook run pre-push`.
2. Host campaign: a memory finding at level 1 and one at level 2 reach the model on Claude Code, Codex, Cursor, Copilot, OpenCode and Kilo, each through the built distribution; aidd-telemetry records as before on Claude Code and Codex.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | fewer words than at phase 1; on Haiku first, then Qwen 3.8 Flash: correct facts at least as many, wrong facts no more, cost lower or equal; every injected drift flagged, the stale count by the engine; no file changed without approval |
| 2 | no doc names a file the skill no longer writes |
| 3 | both gates exit 0; the campaign has one passing row per host, traceable to its log |
