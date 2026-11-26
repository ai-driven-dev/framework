---
status: done
---

# Instruction: Skills run their own copy

## Architecture projection

```txt
.
├── plugins/
│   └── aidd-ui/
│       └── skills/
│           └── 03-foundations/
│               └── references/
│                   └── engine.md ✏️
└── scripts/
    ├── __tests__/
    │   └── check/
    │       └── repo-content-contract.test.js ✏️
    └── check/
        └── contracts/
            ├── custom/
            │   └── skill-paths-inside.cjs ✅
            └── repo.json ✏️
```

## Test Scope

| Scenario   | Action                                        | Observable outcome                     | Actor  |
| ---------- | --------------------------------------------- | -------------------------------------- | ------ |
| Setup      | a Kairos copy and the flat Codex install      | skills under `.agents`, hooks under `.codex` | cli |
| Happy path | run a journey that calls the engine           | each call runs the skill's own copy    | cli    |
| Edge case  | a skill file naming `../../hooks`             | the content check names that line      | system |

## Tasks to do

### `1)` Engine reference

> Each skill names the copy beside its `SKILL.md`.

1. Replace the install table of each `references/engine.md` with `scripts/aidd-ui/aidd-ui.cjs`, next to the loaded `SKILL.md`.

### `2)` Outside-path check

> A skill file that reaches outside its folder is a finding.

1. SKILL-21 covers markdown links only: add REPO-11 for a backticked path that climbs out of its skill.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | on a Kairos copy, the engine of a flat Codex install runs from `.agents/skills/` and answers as the hook's own |
| 2    | a skill file naming a path above its folder fails `node scripts/check/run.cjs` |
