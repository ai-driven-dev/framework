---
status: pending
---

# Instruction: Baseline: measure the skill before any change

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── aidd_docs/tasks/2026_11/2026_11_04_lean-project-memory/
    └── measure.md ✅
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | a harness outside the repository copies the skill at this head into fresh projects, as `scripts/skill-eval` does | each run uses this copy, never an installed plugin | system |
| Happy path | `setup` on two real repositories with no bank, three runs each on Haiku, then Qwen 3.8 Flash | each bank kept with its cost | system |
| Edge case | `refresh` on a bank with four drifts injected: a stale count, a renamed path, a removed command, an architecture claim the code contradicts | the drifts flagged and the files changed are recorded | system |
| Edge case | a blind grader reads each bank against its repository | correct facts, wrong facts, format errors from `memory-lint.cjs` | system |
| Teardown | the harness projects stay under `~/skill-tests/` | the repository is unchanged | system |

## Tasks to do

### `1)` Harness

> Same cases before and after, nothing else changing.

1. Build the harness outside the repository from `scripts/skill-eval` and the review replay method: skill copied under a unique name, Claude through `claude -p`, Qwen 3.8 Flash through `opencode run` with `opencode-go/qwen3.8-flash`, cost read from each run's own output on both.
2. Pick two repositories with no bank and one bank for refresh; state each choice and why in `measure.md`.
3. Write the drift injection and the blind grading rubric; the grader sees neither the version nor the model.

### `2)` Baseline

> Numbers to beat.

1. Run the 6 cases of `scripts/skill-eval/cases.json` for `02-project-memory` on Haiku.
2. Run setup and refresh on Haiku, three runs each, and grade them; then the same on Qwen 3.8 Flash.
3. Count the skill's total words at this head, the number #1141 says to beat.
4. Record in `measure.md`: per model, correct and wrong facts, drifts flagged, files changed without approval, engine errors, words read, cost.

### `3)` How many findings a model handles

> The warning cap is measured, not guessed.

1. On Haiku, then Qwen 3.8 Flash: one write answered with 3, 10 and 25 findings, three runs each.
2. Record per count the findings fixed, missed and the tokens spent; the cap is the highest count with none missed.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | the harness runs one case end to end and the repository's `git status` is unchanged |
| 2 | `measure.md` holds one row per model and case, each traceable to its run folder |
| 3 | `measure.md` states the cap with the runs behind it |
