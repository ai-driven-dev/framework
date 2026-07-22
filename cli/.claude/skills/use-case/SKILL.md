---
name: use-case
description: >
  Creates or modifies application use-cases in src/application/use-cases/. Use when implementing
  business orchestration for a new feature, extracting a reusable shared use-case, adding a
  capability sub-use-case, or wiring a PostInstallPipeline delegation. Do NOT use for creating a
  new CLI command surface — use `command` instead. Do NOT use for I/O translation — use `adapter`
  instead. Do NOT use for domain type definitions — use `domain-model` instead.
---

# Use Case

Builds the business orchestration layer: classes that receive typed options, coordinate ports and
domain models, and return typed results. Each use-case has a single `execute()` method, never
catches its own errors, and delegates all file-and-manifest writes to `PostInstallPipelineUseCase`.

## Available actions

| #   | Action              | Role                                              | Input                                   |
| --- | ------------------- | ------------------------------------------------- | --------------------------------------- |
| 01  | `define-types`      | Declare `*Options` and `*Result` interfaces       | use-case name + field list              |
| 02  | `write-execute`     | Write the `execute()` method body (≤20 LOC)       | types from 01                           |
| 03  | `extract-methods`   | Extract intent-named private helper methods       | execute() body from 02                  |
| 04  | `wire-errors-and-pipeline` | Add typed throws + delegate to PostInstallPipeline | methods from 03              |
| 05  | `test`              | Write integration-tier unit tests                 | completed use-case from 04              |

## Default flow

`01 → 02 → 03 → 04 → 05`

## Transversal rules

- Class name ends in `UseCase`; single `async execute()` method; never a plain function.
- Every method (public or private) ≤ 20 lines; extract named private methods before reaching the limit.
- Shared sub-use-cases live in `src/application/use-cases/shared/` and are never called from commands.
- Capability sub-use-cases live in subdirectories (`install/`, `update/`) and receive narrowed types.
- Never call `manifestRepo.save()` in isolation; delegate to `PostInstallPipelineUseCase`.
- Use constructor injection order: FileSystem → Repository → Loader → Hasher → Logger → Platform → Prompter.
- Use `import type` for type-only imports; `.js` extensions on all relative imports.
- Named export only.

## References

- `references/use-case-rules.md` — class shape, constructor order, Prompter restrictions, user-file protection
- `references/shared-use-cases.md` — shared sub-use-case placement and contract
- `references/capability-sub-use-cases.md` — capability guard pattern, narrowed types
- `references/post-install-pipeline.md` — pipeline delegation rules

## Invariant rules

- `references/use-case-rules.md` — authoritative use-case rules
