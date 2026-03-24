---
name: decision
description: Remove init and adopt CLI commands
argument-hint: N/A
---

# Decision: Remove init and adopt CLI commands

| Field   | Value                        |
| ------- | ---------------------------- |
| ID      | DEC-009                      |
| Date    | 2026-03-24                   |
| Feature | setup / CLI surface          |
| Status  | Accepted                     |

## Context

`aidd init` and `aidd adopt` were hidden from `--help` since #58 because `aidd setup` orchestrates both flows. They remained registered only because ~125 e2e tests bootstrapped test environments via `runCli(["init", ...])` and `runCli(["adopt", ...])`. Hidden commands create an undocumented API surface that can be invoked accidentally and complicates maintenance.

## Decision

Remove `init` and `adopt` as CLI commands entirely. Add programmatic helpers `initProject()` / `adoptProject()` in `tests/e2e/helpers.ts` that call `SetupUseCase` directly (non-interactively). `InitUseCase` and `AdoptUseCase` remain intact — used internally by `SetupUseCase`.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| ----------- | ---- | ---- | ---------------- |
| Keep commands hidden indefinitely | No migration work | Hidden API surface, maintenance burden, accidental invocation risk | Contradicts the principle that `setup` is the single entry point |
| Convert tests to use `runCli(["setup", ...])` | Consistent with public API | `setup` is TTY-only, not usable in non-interactive test subprocess | Technically blocked |

## Consequences

- `aidd init` and `aidd adopt` return "unknown command" — cleaner public API
- Test bootstrap is faster (in-process use-case calls vs subprocess spawning)
- `commands/init.ts` and `commands/adopt.ts` deleted — less code to maintain
- `SetupUseCase` is now the sole programmatic and interactive entry point for setup flows
