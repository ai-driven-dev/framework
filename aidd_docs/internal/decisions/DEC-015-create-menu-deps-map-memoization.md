# Decision: createMenuDeps() + Map memoization for createDeps

| Field   | Value                  |
| ------- | ---------------------- |
| ID      | DEC-015                |
| Date    | 2026-03-28             |
| Feature | interactive-menu / deps |
| Status  | Accepted               |

## Context

The interactive menu needs `ManifestRepository` and `Prompter` before `program.parse()` — before any command action runs. `createDeps` is async and builds the full dependency graph (including I/O). Two problems: (1) calling `createDeps` twice (in `preAction` hook and in each command action) triggers double I/O; (2) a module-level singleton `_cachedDeps` caused E2E test failures when `describe.concurrent()` ran tests with different `projectRoot` values concurrently — first call won and all subsequent tests used the wrong deps.

## Decision

Two factories in `deps.ts`:
- `createMenuDeps(projectRoot)` — synchronous, creates only `ManifestRepository` + `Prompter`; called before `program.parse()` in `cli.ts`
- `createDeps(projectRoot, options, output)` — async, full graph; memoized in a `Map<string, Deps>` keyed by `projectRoot`

`preAction` hook always runs first and populates the Map. Command actions call `createDeps` again and get the cached instance instantly — zero extra I/O.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| ----------- | ---- | ---- | ---------------- |
| Singleton `_cachedDeps` | Simple | Breaks concurrent tests with different roots | Isolation failure in test suite |
| Pass deps through Commander opts | Avoids double-call | Commander not designed for this | Breaks command encapsulation |

## Consequences

- E2E tests with `describe.concurrent()` and different `projectRoot` per test work correctly
- `preAction` hook + command action share the same `Deps` instance — no double I/O in production
- `createMenuDeps` keeps pre-parse deps minimal and synchronous
