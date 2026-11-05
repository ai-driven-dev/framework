---
status: done
---

# Instruction: What the skill writes: the memory and one README

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/aidd-context/skills/02-project-memory/
│   ├── assets/templates/
│   │   ├── README.md ✏️
│   │   ├── GUIDELINES.md ❌
│   │   ├── CONTRIBUTING.md ❌
│   │   └── memory/README.md ❌
│   └── references/
│       ├── capabilities.md ✅
│       ├── capability-signals.md ❌
│       ├── memory-destinations.md ❌
│       └── structure.md ❌
└── scripts/skill-eval/
    └── cases.json ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | a project with no `aidd_docs/` | empty | system |
| Happy path | setup writes the bank | `aidd_docs/README.md`, `memory/*.md`, `memory/internal/`, `memory/external/`; no `GUIDELINES.md`, `CONTRIBUTING.md` or `memory/README.md` | system |
| Edge case | a project that already holds `GUIDELINES.md`, `CONTRIBUTING.md` and a memory README with its markers | all three kept unchanged; the memory block still fills | system |
| Edge case | the README template copied into a temp bank as `readme-probe.md`, `memory-lint.cjs` run on it | no error, since the engine skips any `README.md` | system |

## Tasks to do

### `1)` The README

> A team opening `aidd_docs/` knows what it is, who writes it, how to change it.

1. Rewrite `assets/templates/README.md` with the approved content: what the AI knows (`memory/`, `memory/internal/`, `memory/external/`, `rules/`), what it produces (`tasks/`, `backlog/`, `product/`, `ui/`, `recipes/`, `INSTALL.md`), the flow to change it as a diagram, the two hooks as a table, links to Get started, Guides and Concepts.

### `2)` One capability table

> Scan and check read one place: how a capability is detected, which file it writes, where.

1. Merge `capability-signals.md`, `memory-destinations.md` and `structure.md` into `capabilities.md`: one row per capability, `Capability | Detected when | File | Always | Former files`, then the bank tree.
2. The tree: the skill writes only root files of `memory/`, plus `internal/` and `external/`; `internal/decisions/` holds decision records; a team's own root file is loaded and kept.
3. `Former files` lists the template files a capability replaced, so check can offer to merge an old bank's file.

### `3)` Drop the team templates

> The skill writes nothing a human must fill.

1. Delete the `GUIDELINES.md`, `CONTRIBUTING.md` and memory `README.md` templates.
2. Update the eval cases that expect the dropped files or their placeholder text.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | the README template holds no placeholder and, copied under another name into a bank, passes `memory-lint.cjs` |
| 2 | every capability of the old two tables is a row of `capabilities.md`; no other skill file names the three merged references |
| 3 | no file of the skill names the dropped templates; the eval cases match what setup now writes |
