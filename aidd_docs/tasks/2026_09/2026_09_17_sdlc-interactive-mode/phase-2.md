---
status: done
---

# Instruction: the recipe that opens a request on a branch nobody pushed

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── plugins/
    └── aidd-context/
        └── skills/
            └── 12-cook/
                └── assets/
                    └── recipes/
                        └── ✏️ ship-a-feature.md
```

## User Journey

```mermaid
flowchart TD
  A["a reader follows the ship recipe"] --> B["the commit step runs"]
  B --> C{"was the branch pushed"}
  C -- no --> D["the request step has no branch on the remote"]
  C -- yes --> E["the request opens against a branch that exists"]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    read the ship recipe end to end => the two steps that produce a request: 5: cli
  section Happy path
    follow the commit step as written => the branch reaches the remote: 5: cli
    follow the request step next => a request can exist against that branch: 5: cli
  section Edge case - the option is missing
    drop the option from the commit step => follow both steps => the request step has nothing on the remote to open against: 1: cli
```

## Tasks to do

### `1)` Push in the step that commits

> A recipe that ends in a request needs a branch the remote has.

1. In `ship-a-feature.md`, make the commit step run the commit skill with its `push` option, in the prose and in the copyable block.
2. Say why in the step's own sentence, so the option does not read as decoration.
3. Change nothing else: the commit skill already pushes when that option is set, and the request skill keeps its rule against pushing.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Following the recipe as written leaves the branch on the remote before the request step runs |
| 1 | The commit skill and the request skill are unchanged |
| 1 | The step says why it pushes |
