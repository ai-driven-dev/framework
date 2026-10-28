---
status: pending
---

<!-- Replace every `{{...}}` with its content, or omit the section, and delete every comment; never add, rename, or reorder one. -->

# Instruction: {{title}}

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
```

## Test Scope

<!-- Required for every phase. One edge case row per known trigger; Teardown only when a scenario changes state. -->

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | {{prepare fixture}}       | {{ready state}}        | {{browser, api, cli, or system}}  |
| Happy path   | {{action}}                | {{observable outcome}} | {{browser, api, cli, or system}}  |
| Edge case    | {{trigger and action}}    | {{observable outcome}} | {{browser, api, cli, or system}}  |
| Teardown     | {{cleanup}}               | {{baseline restored}}  | {{browser, api, cli, or system}}  |

## Wireframe

<!-- UI phase only, drawn per [wireframe conventions](../references/wireframe-conventions.md); omit the section otherwise. -->

```txt
{{the confirmed wireframe}}
```

## Tasks to do

### `{{number}})` {{name}}

> {{straight to point goal}}

1. {{ultra concise step}}

## Test acceptance criteria

<!-- Each row maps to a task of this phase; each criterion is an observable behavior. -->

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1... | {{observable behavior of the task}} |
