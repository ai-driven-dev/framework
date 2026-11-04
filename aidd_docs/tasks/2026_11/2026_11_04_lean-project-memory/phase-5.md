---
status: pending
---

# Instruction: Lean references: tables, no essay

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── plugins/aidd-context/skills/02-project-memory/
    ├── assets/scan-summary.md ✏️
    └── references/
        ├── memory-rules.md ✏️
        ├── reading-sources.md ✏️
        ├── ecosystem-signals.md ✏️
        └── tools.md ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | word count of these files at the base head | the number to beat | system |
| Happy path | each file rewritten | the same rows and verdicts, prose turned into table rows | system |
| Edge case | a keep-or-drop verdict of `reading-sources.md` that `memory-rules.md` already states | kept in `memory-rules.md` only | system |

## Tasks to do

### `1)` References

> Every fact once, as a row.

1. `reading-sources.md`: the reading order and depth as rows; its keep-or-drop table moves to `memory-rules.md`.
2. `ecosystem-signals.md`: actors, access modes, edges and detection as tables, no prose.
3. `tools.md`: unchanged rows, prose bullets cut to what sync needs.
4. `scan-summary.md`: its two tables and the question.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | fewer words than the base; every signal, verdict and access mode still present; no sentence repeated across the skill (`scripts/check-doc-duplication.js`) |
