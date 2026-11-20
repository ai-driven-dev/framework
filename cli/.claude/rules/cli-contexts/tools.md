---
description: Apply when a tool the CLI targets is added or changed, or when code asks what a tool declares; the tools context owns every profile and nothing else names a tool's facts.
paths:
  - "src/contexts/tools/**/*.ts"
  - "src/composition/tools.ts"
  - "tests/contexts/tools/**/*.ts"
---

# Tools

## Reason to change

- What a tool declares: where its files land, how it takes plugins, what its own plugin CLI says, what `aidd translate` builds for it.
- Its language is `src/contexts/tools/glossary.md`; its shape follows `reference-context.md`; the how-to is the `tools` skill.

## Ports

- `ToolCatalog` (`contract/tool-catalog.ts`): the registered tools, asked by id or walked in a named order; `wireTools()` in `src/composition/tools.ts` builds the one catalog.
- `AiToolProfile`, `IdeToolProfile` (`contract/tool-profile.ts`) and `ToolBuildContract` (`contract/build-contract.ts`): the answers a caller asks.

## Rules

- Outside callers import `contract/` only; Biome shuts `domain/` and `application/` (`HELD_BY_BIOME` in `tests/architecture/allowed-edges.ts`, `APPLICATION_CLOSED` in `tests/architecture/helpers.ts`).
- A class takes the catalog in its constructor (the `shape` rule of `kinds.ts`), asks a profile a question and never reads its structure.
- Adding a tool: the `tools` skill.
- `src/composition/tools.ts` and `src/composition/host-registration.ts` are the only readers of `domain/`.
- Exceptions to the context shape are in the exceptions table of `reference-context.md`.

## Tests

- `tests/contexts/tools/` mirrors the source, except the `hooks-*.integration.test.ts` suites at its root, which run each tool's hook runtime end to end; `profile-conformance.ts` and `profile-file-conformance.ts` in `testing/` hold what every profile must pass.
- A profile's declared data gets no test of its own; a rule over it is a conformance check, proven against a profile built to break it.
- `aProfile()` in `testing/profiles.ts` builds a synthetic profile; `registeredTools()` and `TOOL` in `tests/shared/testing/registered-tools.ts` give the registered catalog and ids.
- New tests take tools from the shared kit `registeredTools()`; one over every tool walks `REGISTERED_PROFILES`.
