---
status: pending
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
    └── check/
        └── contracts/ ✏️
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

1. Add the rule to the skill content check, unless an existing one covers it.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | a journey on the Kairos copy runs every engine call from the skill's copy |
| 2    | a skill file naming a path above its folder fails `node scripts/check/run.cjs` |
