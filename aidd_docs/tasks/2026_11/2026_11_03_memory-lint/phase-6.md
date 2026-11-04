---
status: done
---

# Instruction: Review fixes: a hook that loads anywhere and answers in one glance

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/aidd-context/hooks/
│   ├── hooks.json ✏️
│   ├── memory-hook.js ❌
│   ├── memory-hook.cjs ✅
│   ├── memory-lint.js ❌
│   ├── memory-lint.cjs ✅
│   └── lib/
│       ├── memory-rules.js ❌
│       └── memory-rules.cjs ✅
├── cli/src/contexts/framework/application/framework/translator/project-hooks-materializer.ts ✏️
└── scripts/__tests__/
    ├── memory-hook.test.js ✏️
    └── memory-lint.test.js ✏️
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | a temp project whose `package.json` declares `"type": "module"`, the hook copied into it | files on disk | system |
| Happy path   | an `Edit` adding one line with a volatile count to a memory file that already holds other errors | one line naming that file, that line and the rule; nothing about the older errors | system |
| Edge case    | the hook run inside the `"type": "module"` project | it loads, answers, exits 0 | system |
| Edge case    | a `Write` of a whole memory file with seven errors and warnings | at most five lines, errors only, then `+N` | system |
| Edge case    | a Codex patch adding lines | only the added lines are checked | system |
| Edge case    | the engine throws | no output, exit 0 | system |
| Teardown     | remove the temp projects | baseline restored | system |

## Tasks to do

### `1)` Loads in any project

> A copied hook never depends on the host project's module type.

1. Rename the three files to `.cjs`, update their requires, `hooks.json`, the tests and the catalogs.
2. Write first a hook test that runs it under a `"type": "module"` `package.json` and expects exit 0 and its answer.

### `2)` One glance

> The hook says only what this write broke, in the fewest lines.

1. Write the failing tests first.
2. Check only the lines this write produced: the `new_string` of an `Edit`, each `edits[].new_string` of a `MultiEdit`, the `+` lines of a patch, the whole file for a `Write`.
3. Report errors only, at most five lines, each `<file>:<line> <rule> <short reason>`, then `+N` when more; warnings stay for the engine by hand.

### `3)` Minor findings

> What the review left open.

1. Make the error message in `project-hooks-materializer.ts` name no tool.
2. Add the test where the engine throws: no output, exit 0.

### `4)` Gates

> Nothing regresses.

1. Run the wrapped scripts suite, `cd cli && pnpm test`, `pnpm exec lefthook run pre-commit --all-files` and `pnpm exec lefthook run pre-push`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | the hook answers and exits 0 inside a `"type": "module"` project |
| 2 | an edit to a file with older errors reports only its own; no answer exceeds five lines or carries a warning |
| 3 | the materializer message names no tool; a throwing engine gives no output and exit 0 |
| 4 | every suite and gate passes, nothing skipped beyond the opt-in e2e |
