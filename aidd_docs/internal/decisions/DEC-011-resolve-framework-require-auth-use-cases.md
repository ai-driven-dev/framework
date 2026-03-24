---
name: decision
description: ResolveFrameworkUseCase and RequireAuthUseCase replace plain functions
argument-hint: N/A
---

# Decision: ResolveFrameworkUseCase and RequireAuthUseCase

| Field   | Value                           |
| ------- | ------------------------------- |
| ID      | DEC-011                         |
| Date    | 2026-03-24                      |
| Feature | resolve-framework / require-auth |
| Status  | Accepted                        |

## Context

`resolveFramework`, `resolveFrameworkWithFallback`, and `requireAuth` were plain exported functions in the application layer. `isLocalPath` was a private function duplicated across files. Auth and resolution were always called together in commands but as separate steps, with the same conditional pattern repeated 3 times.

## Decision

- Replace plain functions with `ResolveFrameworkUseCase` class: absorbs resolution logic, auth delegation (via `RequireAuthUseCase` when source is remote), and `isLocalSource` as a public static method.
- Replace `requireAuth` plain function with `RequireAuthUseCase` class: single source of auth logic.
- Delete `src/application/require-auth.ts`.
- All commands (`install`, `update`, `restore`) pass `authReader` to `ResolveFrameworkUseCase` — auth handled internally.
- `SetupUseCase` passes `authReader` to `ResolveFrameworkUseCase` consistently with commands (no upfront auth check).
- `self-update` uses `RequireAuthUseCase` directly (no framework resolution involved).

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| ----------- | ---- | ---- | ---------------- |
| Export isLocalPath as named function | Simple | Not cohesive, creates thin module | Static method on class is more cohesive |
| Domain model for isLocalPath | Architecturally clean | Name collision with FrameworkSource type in port; weak domain weight | Application layer is the right home |
| Keep plain functions | No change | Duplication, plain functions mix with class use-cases | Inconsistent with use-case pattern |

## Consequences

- Auth logic exists once in `RequireAuthUseCase`, delegated by `ResolveFrameworkUseCase`
- `isLocalSource` private to `ResolveFrameworkUseCase`, exposed as static for callers needing pre-classification
- Local path → auth never called (correct behavior, previously required auth upfront in SetupUseCase)
- Commands simplified: one constructor call replaces two sequential function calls
- `resolve-framework-use-case.ts` is now a proper use-case class file
