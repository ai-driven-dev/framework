---
description: Apply when adding, moving or importing a module under src; import rules, ports, commands, errors, size, names and the review grid.
paths:
  - "src/**"
---

# Source Architecture

## Import rules

Allowed edges are the rows of `ALLOWED` in `tests/architecture/helpers.ts`.
1. A context reads another through its `contract/` only, and `application/` is for presentation and orchestration: `context-graph.arch.test.ts`, `biome.json`.
2. A `contract/` file has an importer in another context, or it returns to `domain/`: `context-boundary.arch.test.ts`.
3. An edge absent from `ALLOWED` is an error: `context-graph.arch.test.ts`, `biome-context-parity.arch.test.ts`.
4. No import cycle: Biome `noImportCycles`.
5. A pure folder imports no adapter, no package and no Node module but `node:path` and `node:crypto`: `biome.json`, `biome-guards-bite.arch.test.ts`.
6. Orchestration imports the `application/` and `contract/` of contexts only, reads no file and starts no process: `biome.json`.
7. Only `composition/` imports `shared/infrastructure/`, and only `cli.ts` imports `composition/`: `biome.json`.
8. A `shared/` file is earned by two importing contexts: `earned-sharing.arch.test.ts`.

## Ports and wiring

- A port sits in `ports/` beside `domain/`, on the side that needs it; one two contexts need goes to `shared/ports/` and its adapter to `shared/infrastructure/`.
- An adapter implements one port, lives in the owner's `infrastructure/`, is named `*Adapter`, and does I/O and format translation only.
- A class takes its ports through the constructor, typed as the port, and `composition/` hands in the adapter.
- `composition/` holds one module per context plus the root and the shared adapters: `composition-holds-one-module-per-context.arch.test.ts`.
- A command receives its dependencies as the `DepsFactory` of `presentation/deps.ts`, built in `cli.ts`.
- A port declares no method nobody calls: `ports-are-called.arch.test.ts`.
- A tool id appears only in its profile and the registration list: `tool-addition-cost.arch.test.ts`.

## Commands, errors, size and names

- A command is one file with one class of the same name, a public `execute`, no `UseCase` suffix: `command-shape.arch.test.ts`.
- A command takes at most 5 constructor dependencies: `orchestrator-deps.arch.test.ts`.
- Every error is a class of `shared/domain/errors.ts`, and each is thrown: `errors-that-are-thrown.arch.test.ts`.
- A message naming a command names a real one: `errors-that-instruct.arch.test.ts`.
- A catch never swallows: `catches-that-swallow.arch.test.ts`.
- `process.exit` stays at the command edge: `biome-plugins/no-process-exit.grit`.
- A directory holds ten direct source files at most: `folder-size.arch.test.ts`.
- A tolerated list only shrinks: `baseline-only-shrinks.arch.test.ts`.
- Exports are named and nothing re-exports: `no-re-export.arch.test.ts`, Biome `noDefaultExport`, `noBarrelFile`, `noReExportAll`.
- Import from the defining module, relative, with the `.js` extension, and `import type` for a type-only import.
- Files are kebab-case, values camelCase, types PascalCase, constants CONSTANT_CASE.
- A name states the intention, and `executeInternal` means no concept was found.
- A copied block fails `pnpm jscpd`; extract at the second caller.

## Review grid

1. Concept: a folder has one reason to change, said in one sentence.
2. Scenario: code coordinating several contexts is orchestration and holds no business rule.
3. Owner: one context calls each external system, behind a port.
4. Port: declared where it is needed, its adapter in the owner's infrastructure.
5. Sharing: a shared module has two real importers from different contexts.
6. Error: thrown once, catalogued, saying what to do.
7. No context names a tool outside its profile.
8. A command lets errors rise; a catch translates or recovers, never silences.
9. Names: a command carries a verb, its `Command` and `Result` take the class name, a port a capability name.
10. Domain: immutable value objects, one repository per aggregate, a `glossary.md` in the context.
11. `contract/`: every published type is imported by another context.
