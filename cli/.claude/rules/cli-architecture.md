---
description: Apply when adding, moving or importing a module under src; import rules, ports, commands, errors, size, names and the review grid.
paths:
  - "src/**"
---

# Source Architecture

## Import rules

Allowed edges are the rows of `ALLOWED` in `tests/architecture/allowed-edges.ts`.
1. A context reads another through its `contract/` only, and `application/` is for presentation and orchestration: the `imports` rule of `kinds.arch.test.ts`, `biome.json`.
2. A `contract/` file has an importer in another context, `presentation/` or `orchestration/`; `composition/` and `orchestration/deps.ts` do not count: `contractReaderViolations`, in `kinds.rules.arch.test.ts`.
3. An edge absent from `ALLOWED` is an error: the `imports` rule of `kinds.arch.test.ts` and `biome-guards-bite.arch.test.ts`.
4. No import cycle: Biome `noImportCycles`.
5. Pure folders import no package and no Node builtin but `node:path` and `node:crypto`. Biome holds it for the `PURE_FOLDERS` of `biome-guards-bite.arch.test.ts`; in every other `domain/`, the kind gate (`kinds.ts`) holds it: a model imports models and `node:path` and `node:crypto` only, an inline `import("node:…")` included.
6. Orchestration imports the `application/` and `contract/` of contexts only, reads no file and starts no process: `biome.json`.
7. Only `composition/` and `cli.ts` import `shared/infrastructure/`, and only `cli.ts` imports `composition/` from outside it: `biome.json`, for every folder but `cli.ts`.
8. A `shared/domain/` or `shared/ports/` file is earned by two importing contexts; a `shared/infrastructure/` file by implementing an earned shared port, being imported by an earned shared adapter, or two `composition/` importers: `earned-sharing.arch.test.ts`.

## Ports and wiring

- A port sits in `ports/` beside `domain/`, on the side that needs it; one two contexts need goes to `shared/ports/` and its adapter to `shared/infrastructure/`.
- An adapter implements one port, lives in the owner's `infrastructure/`, is named `*Adapter`, and does I/O and format translation only.
- A class takes its ports through the constructor, typed as the port, and `composition/` hands in the adapter.
- `composition/` holds one module per context plus the root and the shared adapters: `composition-holds-one-module-per-context.arch.test.ts`.
- A command receives its dependencies as the `DepsFactory` of `orchestration/deps.ts`, built in `cli.ts`.
- `createContainer` builds each context's wiring on its first read and keeps it for that container; a command keeps no second cache.
- A port, a `contract/` port included, declares no method nobody calls: `ports-are-called.arch.test.ts`.
- A tool id appears only in its profile and the registration list: `tool-addition-cost.arch.test.ts`.

## Commands, errors, size and names

- A use case is one file with one class of the same name, a public `execute` and at most 5 constructor dependencies: the `shape` rule of `kinds.ts`.
- An error is a class in the `<owner>.error.ts` of its context, of `orchestration/`, of `presentation/`, or of `shared/domain/` when two contexts need it; each class there is thrown: `errors-that-are-thrown.arch.test.ts`.
- A message naming a command names a real one: `errors-that-instruct.arch.test.ts`.
- An empty catch is a failure unless a `biome-ignore lint/plugin: <reason>` above its `try` says why (`biome-plugins/no-swallowed-catch.grit`).
- A `*-all` flow over several scopes catches each scope into `errors[]` and returns them, so one failure never aborts the run.
- `process.exit` stays in the composition root, which hands presentation an `Output` port ending the run: [`3-cli-process.md`](03-frameworks-and-libraries/3-cli-process.md).
- File length, function length, cognitive complexity, parameter counts and one class per file are capped by `biome.json`; the baselines only shrink: `biome-guards-bite.arch.test.ts`.
- Tolerated debt is `tests/architecture/kinds-debt.json`, and it only shrinks: `debt-only-shrinks.arch.test.ts`.
- Exports are named and nothing re-exports: `biome-plugins/no-inline-re-export.grit`, Biome `noDefaultExport`, `noBarrelFile`, `noReExportAll`.
- Import from the defining module, relative, with the `.js` extension, and `import type` for a type-only import.
- Files are kebab-case, values camelCase, types PascalCase, constants CONSTANT_CASE.
- A name states the intention, and `executeInternal` means no concept was found.
- A copied block fails `pnpm jscpd`; extract at the second caller.

## Review grid

1. Concept: a folder has one reason to change, said in one sentence.
2. Scenario: code coordinating several contexts is orchestration and holds no business rule.
3. Owner: one context calls each external system, behind a port.
4. Port: declared where it is needed, its adapter in the owner's infrastructure.
5. Sharing: a shared file is earned, import rule 8.
6. Error: thrown once, catalogued, saying what to do.
7. No context names a tool outside its profile.
8. A command lets errors rise; a catch translates or recovers, never silences.
9. Names: a command carries a verb, its `Command` and `Result` take the class name, a port a capability name.
10. Domain: immutable value objects, one repository per aggregate, a `glossary.md` in the context.
11. `contract/`: no file without a reader, import rule 2.
