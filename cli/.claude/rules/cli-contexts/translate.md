---
description: Apply when a plugin's content is rewritten for a tool or a native tree is built; the translate context owns the engine and the sink, and nothing else rewrites plugin content.
paths:
  - "src/contexts/translate/**/*.ts"
  - "src/composition/translate.ts"
  - "tests/contexts/translate/**/*.ts"
---

# Translate

## Reason to change

- How a canon plugin is rewritten for one tool, in memory, and how the result is written to disk for `aidd translate`.
- Its language is `src/contexts/translate/glossary.md`; a name in the code means what that page says.
- Its shape follows `reference-context.md`, beside this page, bar the exceptions below.

## Boundary

- Outside callers import `translate/contract/` only. `domain/`, `ports/` and `infrastructure/` are the composition root's, held by Biome (`HELD_BY_BIOME` in `tests/architecture/helpers.ts`).
- `application/` is read by the composition root and the presentation deps that hand the build in; `contract/` carries what other contexts name: the build targets, the translation port and the file it answers with.
- The engine asks the tool catalog what a tool declares and never names a tool.
- The engine writes nothing; the sink writes and never rewrites content.

## Suppliers

- `tools/contract/`: the profile and its build contract the engine asks.
- `shared/`: errors, logger and the plugin distribution types.

## Exceptions in force

- M-S1: `installation` hands the translation in and reads this context's `contract/` through one `ALLOWED` row. Its row is in section 9 of `reference-context.md`, with when it goes.
- The sink and the engine still differ in bytes on listed paths (`DIVERGENCES` in `tests/contexts/translate/application/translate-distribution-conformance.integration.test.ts`); the list only shrinks, and a change of bytes is a `fix(cli)` of its own.

## Tests

- `tests/contexts/translate/`, mirroring the source, with the kit in `testing/` (`plugin-content-translator-kit.ts`).
- A guard ships with the mutation that proves it; the context's mutation scope is `translate` in `mutation-scopes.json`.
- Stub a tool with `aProfile()` or `withSections`; a real layout stands for the sink.

## Never

- Name a tool id in the engine: a branch on a tool is a question its profile should answer.
- Write to disk from `domain/`.
- Import `domain/`, `ports/` or `infrastructure/` from another context.
