---
status: pending
---

# Instruction: docs and pilots

## Architecture projection

```txt
.
├── plugins/aidd-ui/README.md ✏️
└── aidd_docs/tasks/2026_10/2026_10_30_aidd-ui-rework/spec.md ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | scratchpad: an empty git folder for the breathing app; `git archive origin/main` of Gouvernail and of Kairos; the plugin from this branch | copies ready, sources untouched | system |
| Happy path | `claude -p --model haiku` runs `02-journeys` on the blank pilot from a persona, before any design system | each journey wanted, a wireframe per step, `validate` without error | cli |
| Edge case | a model runs it on the Gouvernail and Kairos copies | journeys and wireframes deduced from real screens, `validate` without error | cli |
| Teardown | none | sources never written | system |

## Tasks to do

### `1)` Docs

> Readers find the new skill and its records.

1. README: both skills, how it works, limits the pilots show.
2. Global spec: `wireframes/` in the tree, wireframe row and journey persona in the records table.

### `2)` Pilots

> The done-when holds on real projects.

1. Blank breathing app, then Gouvernail and Kairos copies, each run by `claude -p --model haiku`.
2. A finding becomes a test first, then its fix.

### `3)` Contributor checks

> Every gate green before the pull request.

1. `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'`.
2. `pnpm exec lefthook run pre-commit`.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | README and global spec name wireframes and the persona section |
| 2 | each pilot ends at 0 errors with journeys and wireframes |
| 3 | suite and pre-commit pass |
