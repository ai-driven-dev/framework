---
description: Apply before creating or moving into a shared/ directory; sharing is earned by two consumers.
paths:
  - "src/contexts/**/*.ts"
  - "src/shared/**/*.ts"
---

# Shared Modules

## `src/shared/`

- A `shared/domain` or `shared/ports` file enters when two contexts import it. Presentation and composition consume it but are not contexts.
- A `shared/infrastructure` file enters when it implements an earned shared port, when an earned shared infrastructure file imports it, or when two composition files import it.
- `earned-sharing.arch.test.ts` holds both rules over every file under `src/shared/`. A file short of its rule moves into its one context, or is deleted when nobody imports it. No baseline of exceptions exists.

## A `shared/` directory inside a context

- It needs callers in two areas, held by `earned-sharing.arch.test.ts`, until framework splits.
- One caller: move it down.
- Never share for a caller not yet written.
- An area is `application/<subdirectory>/` or the application root.
- `composition/` is never an area.
- Count first: `grep -rl <module> src`; `earned-sharing.arch.test.ts` counts the same.
- A file nested under a shared module is its private step.
- A promoted module follows `0-hexagonal.md`.
- Crossing a context: declare the module public (`0-contexts.md`); a migrated context publishes through `contract/` (`reference-context.md`).
- Move to `shared/` only once it stops being business logic; the old `kernel` area no longer exists: `old-layout-count.arch.test.ts` fails if it comes back.
