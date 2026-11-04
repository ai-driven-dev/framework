---
status: pending
---

# Instruction: Lean actions: a file where it belongs, check prints, refresh syncs

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/aidd-context/skills/02-project-memory/
│   ├── SKILL.md ✏️
│   ├── actions/
│   │   ├── 01-scan.md ✏️
│   │   ├── 02-write.md ✏️
│   │   ├── 03-check.md ✏️
│   │   └── 04-sync.md ✏️
│   └── assets/report.md ❌
└── scripts/skill-eval/
    └── cases.json ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | a bank with a stale count, a dead path, a contradicted claim, a team file `principles.md` at the root, `auth.md` under `internal/`, a `kpi/` folder, an old `api.md` | ready | system |
| Happy path | refresh | three blocks printed (structure, format from the engine, content), then the question; no file written before approval | cli |
| Edge case | the team file at the root | not flagged, not offered for removal | cli |
| Edge case | `auth.md` under `internal/`, `kpi/` under `memory/` | flagged as misplaced with the move offered; no root copy created | cli |
| Edge case | the old `api.md` | offered to merge into `contract.md` | cli |
| Edge case | refresh adds or moves a file | the memory block of each wired tool lists it, without asking which tools | cli |
| Edge case | the engine is absent | the rule table applied instead, the same blocks printed | cli |

## Tasks to do

### `1)` A file where it belongs

> The bank is read at its root; anything else is said, never duplicated.

1. In `03-check.md`: a root file no capability writes is the team's, left alone; a capability file found under `internal/` or a subfolder, or a folder under `memory/` other than `internal/` and `external/`, is flagged misplaced with a move offered; a `Former files` match is offered a merge.
2. In `02-write.md`: write only root files; never create a file whose capability is already covered by a misplaced one until the user decides.

### `2)` Check prints

> Findings consumed at once, nothing left behind.

1. Find where each install puts the engine (Claude Code plugin, a flat install through `aidd translate`) and write in `03-check.md` how to find `memory-lint.cjs`, as `04-sync.md` finds `update_memory.js`.
2. Rewrite `03-check.md`: structure from `capabilities.md`, format from the engine (else the rule table), content per `review-protocol.md`; three blocks printed, then the question; a file only on request.
3. Delete `assets/report.md`.

### `3)` Write ends clean, refresh syncs

> No format error survives, the block never lags.

1. `02-write.md` ends with the engine on the written files and fixes what it reports, else applies the rule table.
2. `SKILL.md`: refresh runs scan, check, write, then sync; `04-sync.md` fills the tools already wired without asking when called from refresh.

### `4)` Router and actions

> Each step once, each rule once.

1. Rewrite `SKILL.md`, `01-scan.md` and the action tests: no rule restated, no step named twice.
2. Update the eval cases for check's printed output, the removed report path and the new flows.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | on the setup bank: the team file untouched, the misplaced ones flagged with a move, the old file offered a merge, no duplicate written |
| 2 | on a Claude Code plugin install and on one flat install, check runs the engine; refresh prints three blocks and writes no file unless asked |
| 3 | after setup, `memory-lint.cjs` prints no error; after a refresh that adds a file, each wired tool's block lists it |
| 4 | fewer words than the base; the eval cases pass on Haiku |
