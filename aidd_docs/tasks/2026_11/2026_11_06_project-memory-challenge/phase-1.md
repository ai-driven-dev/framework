---
status: done
---

# Instruction: Each memory file is named by what it holds

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── aidd_docs/tasks/2026_11/2026_11_06_project-memory-challenge/
│   ├── plan.md ✅
│   ├── phase-1.md ✅
│   ├── phase-2.md ✅
│   └── phase-3.md ✅
├── docs/
│   └── GUIDES.md ✏️
├── plugins/
│   └── aidd-context/
│       ├── hooks/
│       │   └── memory.cjs ✏️
│       └── skills/
│           └── 02-project-memory/
│               ├── actions/
│               │   ├── 02-write.md ✏️
│               │   └── 03-check.md ✏️
│               ├── assets/
│               │   └── templates/
│               │       └── memory/
│               │           ├── api/
│               │           │   └── api.md ✅
│               │           ├── cli/
│               │           │   └── cli.md ✅
│               │           ├── core/
│               │           │   ├── architecture.md ✏️
│               │           │   └── codebase-map.md ✅
│               │           ├── data/
│               │           │   └── data.md ✏️
│               │           ├── database/
│               │           │   └── database.md ✅
│               │           ├── desktop/
│               │           │   └── desktop.md ✅
│               │           ├── ecosystem/
│               │           │   └── ecosystem.md ✏️
│               │           ├── messaging/
│               │           │   └── messaging.md ✅
│               │           ├── mobile/
│               │           │   └── mobile.md ✅
│               │           ├── package/
│               │           │   └── package.md ✅
│               │           ├── realtime/
│               │           │   └── realtime.md ✅
│               │           └── ui/
│               │               └── ui.md ✏️
│               └── references/
│                   ├── capabilities.md ✏️
│                   └── memory-rules.md ✏️
└── scripts/
    ├── __tests__/
    │   ├── fixtures/
    │   │   └── memory-question-bank.json ✏️
    │   ├── memory-check.test.js ✏️
    │   ├── memory-skill-files.test.js ✏️
    │   └── memory-templates.test.js ✏️
    └── skill-eval/
        └── cases.json ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | build a bank holding `cli.md`, `codebase-map.md`, `design.md`, `infra.md` and `integration.md` | the bank is ready for `check` | system |
| Happy path | run `check .` and `check cli` on this repository's banks | exit 0, no merge line | cli |
| Edge case: older names | run `check` on the bank above | no merge or former line, no missing-file error | cli |
| Edge case: team contract file | refresh a bank holding a team's `cli.md` (Haiku, three runs) | `cli.md` unchanged where its facts are true, no second contract-like file | cli |
| Edge case: CLI project | set up a CLI project (Haiku, three runs) | `cli.md` written with `# CLI` | cli |
| Teardown | remove the fixture banks | baseline restored | system |

## Tasks to do

### `1.1)` Name templates and capability table by what a file holds

> The lean slice merged capability files under names that tell a reader nothing (`contract.md`, `native.md`, `async.md`, and `data.md` holding the database as well) and folded `codebase-map.md` into `architecture.md`. On Codex, Cursor, OpenCode and Copilot the memory reaches the model as links, so the file name alone decides whether a file is opened. Haiku also created `contract.md` next to a team's `cli.md`, and `check` offered on this repository's banks to merge `cli.md` and `codebase-map.md`, which would build files over the 400-word limit.

1. Follow the plan's naming decision: one row per file in the templates and the capability table.
2. Give each row a one-line meaning and its detection.
3. Remove the templates `contract.md`, `native.md` and `async.md`.
4. A previous attempt at the accepted names, on the parent of this branch, is saved as a reference patch outside the repository.

### `1.2)` Write one file per exposed surface

> A project exposing several surfaces gets one file per surface.

1. Write one file per surface the project exposes.

### `1.3)` Keep the UI macro and point to the UI detail

> `ui.md` keeps the macro questions and never copies the detail.

1. Keep the macro questions in `ui.md`.
2. Add a first slot: when `aidd_docs/ui/` exists, the detail and the design system live there and nothing of them is copied.

### `1.4)` Move the outside-service questions

> Outside services belong to the ecosystem file.

1. Move the outside-service questions to `ecosystem.md`.

### `1.5)` Accept older names without a merge

> A bank's older names are kept and written into, per the plan.

1. Accept the older names per the plan.
2. Delete the engine's former-file and merge path.
3. `check` offers no merge.

### `1.6)` Keep the question bank whole

> Every slot still has a home after the renames.

1. Update the question bank to the new names.
2. Update its guard so every slot still has a home.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1.5 | `memory-check.test.js`: a bank holding `cli.md`, `codebase-map.md`, `design.md`, `infra.md` and `integration.md` gives no merge or former line and no missing-file error; fails on the parent commit |
| 1.1 | `memory-templates.test.js`: no template or table names `contract.md`, `native.md` or `async.md`; `database.md` and `data.md` are two templates; fails on the parent commit |
| 1.4 | `memory-templates.test.js`: `ecosystem.md` holds the outside-service questions; fails on the parent commit |
| 1.3 | `memory-templates.test.js`: `ui.md` holds the macro questions and the `aidd_docs/ui/` slot; fails on the parent commit |
| 1.5 | `check .` and `check cli` exit 0, no merge line |
| 1.2 | Eval, Haiku, three runs: refresh of a bank holding a team's `cli.md` leaves `cli.md` unchanged where its facts are true, with no second contract-like file |
| 1.1 | Eval, Haiku, three runs: setup of a CLI project writes `cli.md` with `# CLI` |
| 1.6 | The question bank guard passes: every slot has a home |
