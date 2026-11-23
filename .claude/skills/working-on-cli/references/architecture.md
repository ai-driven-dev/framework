# CLI architecture

Dependency graph, edges and decisions: [architecture.md](../../../../aidd_docs/memory/internal/cli/architecture.md). Tree and where to add a thing: [codebase-map.md](../../../../aidd_docs/memory/internal/cli/codebase-map.md). Gates to run: [testing.md](../../../../aidd_docs/memory/internal/cli/testing.md). Kinds, suffixes and folders: `cli/tests/architecture/kind-table.ts`, the guard's source of truth. A rule here names its gate.

## Imports

- Need more than the contract allows: declare the narrow input in your own `ports/` and receive the real object by shape. Do not add an edge.
- A `contract/` file has an importer in another context, `presentation/` or `orchestration/`; `composition/` and `orchestration/deps.ts` do not count: `contractReaderViolations` (`kinds.rules.arch.test.ts`).
- Pure folders (`domain/`, `ports/`, `contract/`, `shared/domain/`, `shared/ports/`) import no package and no Node builtin but `node:path` and `node:crypto`, and read no `process`: Biome for `PURE_FOLDERS` (`biome-guards-bite.arch.test.ts`), the kind gate (`kinds.ts`) elsewhere.
- Orchestration imports the `application/` and `contract/` of contexts only, reads no file, starts no process: `biome.json`. Presentation may also import `application/`, except of `tools`.
- Only `composition/` and `cli.ts` import `shared/infrastructure/`; only `cli.ts` imports `composition/` from outside it: `biome.json`.
- No import cycle: Biome `noImportCycles`. Relative imports with `.js`: `tsc` (`NodeNext`).

## Context shape

`src/contexts/<ctx>/`, mirrored by `tests/contexts/<ctx>/`:

| Folder | Holds | May not import |
| --- | --- | --- |
| `glossary.md` | the context's language, in English | |
| `contract/` | what another context or presentation reads: types, published ports | any other folder of its context |
| `domain/` | aggregate, value objects, rules, order | `application/`, `infrastructure/` |
| `ports/` | what the context needs, one interface per file, types only (`port-types-only.grit`) | what `domain/` may not |
| `application/` | use cases, and an implementation of a contract port that is not a command | `infrastructure/` |
| `infrastructure/` | adapters of `ports/`, every piece of I/O | `shared/infrastructure/` |

- A folder of `src/` holds at most 10 files, by `folder-size.arch.test.ts`: split by concept. `tests/` is outside the cap.
- The domain (`model` and `profile` kinds) holds no clock, no logging and no module-level memo; `tests/architecture/kind-text-rules.arch.test.ts` enforces it. Take time from the clock port, return a fact instead of logging, keep a cache in application or infrastructure.
- A port is declared by the side that needs it and named by capability. It declares no optional method and none nobody calls: `ports` rule of `kinds.rules.arch.test.ts`.
- An adapter implements one port, is named `*Adapter`, lives in its owner's `infrastructure/`, and does I/O and format translation only.
- A class takes its ports in the constructor, typed as the port. `composition/` holds one module per context in `composition/contexts/`, plus the root and shared adapters (`composition` rule); `createContainer` builds a context's wiring on first read and keeps it per container.
- A use case: one file, one class named as the file, a public `execute`, a capped number of constructor dependencies (`shape` rule of `kinds.ts`; extract a collaborator when it grows), no `process` (`noRestrictedGlobals`; read the environment through `shared/ports/environment.ts`).
- A tool id appears only in its profile and the registration list: `tool-addition-cost.arch.test.ts`. The GitHub API base only in `shared/infrastructure/github-adapter.ts`: `one-github-api-url.grit`.

## Size and names

- Biome caps file length, function length, cognitive complexity and parameter count, with no file excluded (`biome-size-guards.arch.test.ts`, `biome.json`, `max-function-params.grit`). Split instead of using `biome-ignore`.
- Split a file by concept, one class per file. Split a function by naming each branch or step as its own function. Group parameters into one named object.
- Named exports only, nothing re-exports: `no-inline-re-export.grit`, `noDefaultExport`, `noBarrelFile`, `noReExportAll`. Import from the defining module.
- Files kebab-case (Biome). Values camelCase, types PascalCase, constants CONSTANT_CASE, `import type` for a type-only import: review only.
- A name states the intention; `executeInternal` means no concept was found. A copied block fails `pnpm jscpd`: extract at the second caller.

## Type honesty and comments

- No `as unknown as`, `as any` or `as never` in `src/` or `tests/`, no `@ts-expect-error` or `@ts-ignore` in `src/`: `scripts/check-cli-type-honesty.mjs` at the repository root, run from there (`CASTS_ALLOWED` lists each survivor). A test proving non-compilation may use `@ts-expect-error`. Biome `noTsIgnore` refuses `@ts-ignore` everywhere.
- Comment only what code and names cannot say: a constraint types miss, a measured host quirk, a refused simpler shape. Delete one that restates code or narrates history. Name no ticket, PR, commit, date, review or URL. A paragraph belongs in `aidd_docs/memory/`. No gate holds this.

## Process

The CLI exits when the action resolves.

- Never fire and forget: `unref()` and floating promises die with the process (`noFloatingPromises`). Deferred work rides an online command (`ONLINE_COMMAND_PATHS`, `src/presentation/hooks/update-notice-hooks.ts`), awaits behind a timeout, or runs detached. The hot path is offline: read cache, print, return.
- Assert a side effect against the built binary (e2e or `pnpm smoke`).
- `stdout` carries info, success and results; `stderr` carries debug, warnings and errors. A conflict or skip is `warn`, never `error`. End with a one-line summary.
- The `Output` port (`src/orchestration/domain/output.ts`, adapter `src/presentation/terminal/output.adapter.ts`) routes by level, nothing else. Rendering lives in `presentation/presenters/`; deciding lives in the use case.
- `process.exit` stays out of `shared/`, `contexts/` and `presentation/`: presentation ends a run with `output.exit`, wired in the composition root (`no-process-exit.grit`).
- Exit `0` when it did what was asked. Exit `1` on a thrown error (through `failCommand`), an invalid `--scope` or `translate` flag, an unhealthy `doctor`, a guard needing a TTY, no argument without a TTY, or a result that reports a failure (refused telemetry step, failed marketplace refresh, recipe findings): that command sets `1` itself. A command may exit before its use case on a refusal.

## Exceptions in force

Each stays until its own condition holds; a new deviation is a row here, in the PR that needs it.

- `shared/domain/` imports `node:path` (`paths.ts`, `source-parsing.ts`, `layout/aidd-layout.ts`); closes when none does.
- `userConfigDirOf` sits in `composition/user-config-dir.ts`; closes when a second context reads it and it moves to `shared/domain`.
- `Prompter` has no contract suite: it answers a person at a terminal, e2e journeys drive the real adapter.
- `STORED_ANSWERS` (`kind-answer-rules.ts`) and `STORED_VOCABULARY` (`tool-addition-cost.arch.test.ts`) list stored values answered verbatim; a value a method can answer is asked, not listed.
- Written limits no gate sees: `.md` filenames (Biome lints source only), an aliased or destructured token read (`token-owner.grit`), an empty catch inside template text (`no-swallowed-catch.grit`), an element-access alias of a profile (`profile` rule).
- Per-context test overrides in `biome.json` cover `tests/contexts` and `tests/shared` only: orchestration, presentation, composition, e2e and golden tests may import any kit.
