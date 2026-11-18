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

- Outside callers import `contract/` only; Biome shuts `domain/` and `application/` (`HELD_BY_BIOME`, `APPLICATION_CLOSED` in `tests/architecture/helpers.ts`).
- A class takes the catalog in its constructor (`catalog-in-constructor.arch.test.ts`), asks a profile a question and never reads its structure.
- A tool is one folder under `domain/profiles/` and one line in `REGISTERED_PROFILES`, never a second list; `tool-addition-cost.arch.test.ts` holds that its id appears nowhere else.
- A tool that runs hooks brings its `hooks.ts`, a host adapter in `assets/hooks-runtime/` and one payload fixture per relayed event; conformance checks them.
- `src/composition/tools.ts` and `src/composition/host-registration.ts` are the only readers of `domain/`.
- Exceptions to the context shape are in the exceptions table of `reference-context.md`.

## Tests

- `tests/contexts/tools/` mirrors the source; `profile-conformance.ts` and `profile-file-conformance.ts` in `testing/` hold what every profile must pass.
- A profile's declared data gets no test of its own; a rule over it is a conformance check, proven against a profile built to break it.
- `aProfile()` in `testing/profiles.ts` builds a synthetic profile; `registeredTools()` and `TOOL` in `tests/shared/testing/registered-tools.ts` give the registered catalog and ids.
- `testing/catalog-of.ts` keeps `TOOL` and `resolveRegisteredToolId` as aliases for frozen callers; new tests use the shared kit, and one over every tool walks `REGISTERED_PROFILES`.
