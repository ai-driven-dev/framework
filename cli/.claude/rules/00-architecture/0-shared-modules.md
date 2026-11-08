---
description: Apply before creating or moving into a shared/ directory; sharing is earned by two consumers.
paths:
  - "src/contexts/**/*.ts"
  - "src/shared/**/*.ts"
---

# Shared Modules

## `src/shared/`

- A module enters when two contexts consume it, by import or by being handed its adapter by the composition root.
- No computed check exists yet: the PR that admits a module names its consumers, and registers a module short of two as a migration-state deviation.

## A `shared/` directory inside a context

- It needs callers in two areas, held by `earned-sharing.arch.test.ts`, until framework splits.
- One caller: move it down.
- Never share for a caller not yet written.
- An area is `application/<subdirectory>/` or the application root.
- `runtime/wiring/` is never an area.
- Count first: `grep -rl <module> src`; `earned-sharing.arch.test.ts` counts the same.
- A file nested under a shared module is its private step.
- A promoted module follows `0-hexagonal.md`.
- Crossing a context: declare the module public (`0-contexts.md`); a migrated context publishes through `contract/` (`reference-context.md`).
- Move to `shared/` only once it stops being business logic; `kernel/` receives no new file.
