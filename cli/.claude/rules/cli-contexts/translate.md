---
description: Apply when a plugin's content is rewritten for a tool or a native tree is built; the translate context owns the engine and the sink, and nothing else rewrites plugin content.
paths:
  - "src/contexts/translate/**/*.ts"
  - "src/composition/translate.ts"
  - "tests/contexts/translate/**/*.ts"
---

# Translate

## Reason to change

- How a canon plugin is rewritten for one tool in memory, and how the result is written to disk for `aidd translate`.
- Its language is `src/contexts/translate/glossary.md`; its shape follows `reference-context.md`, beside this page.

## Ports

- `JsonSchemaValidator` (`ports/json-schema-validator.ts`): validates a built manifest or catalog.
- `contract/build-targets.ts`: the targets and modes presentation names; `application/`'s `BuildNativeTree` (`aidd translate`) is handed in by the composition root.

## Suppliers

- `tools/contract/`: the profile and its `ToolBuildContract`, which `src/composition/translate.ts` picks from the catalog; `shared/`: errors, `Logger`, file ports, plugin types.

## Rules

- Outside callers import `contract/` and `application/` only; Biome shuts `domain/`, `ports/` and `infrastructure/` (`HELD_BY_BIOME` in `tests/architecture/allowed-edges.ts`).
- The engine calls each profile's `rewriteContent` and never names a tool: a branch on a tool is a question its profile answers.
- The engine writes nothing; `DiskSink` writes every artifact kind through the contract and, on top of the engine, rewrites only relative links and the plugin-root token and path.
- The install path and `DiskSink` still differ in bytes on what `DIVERGENCES` and `MANIFEST_DIVERGENCES` list in `translate-distribution-conformance.integration.test.ts`; the list only shrinks.

## Tests

- `tests/contexts/translate/` follows the source folders; `testing/` holds the kit (`engine-kit.ts`, `declared-tool-catalog.ts`, `synthetic-tool-profile.ts`); a rewrite is proven on a fixture that carries the marker it rewrites.
- `tests/golden/framework-build.golden.test.ts` freezes a full build per target; its machine-independence rules are in the `test` skill.
