# translate

How a canon plugin is rewritten for one tool in memory, and how the result is written to disk for `aidd translate`. Language: `src/contexts/translate/glossary.md`.

## Ports

- `JsonSchemaValidator` (`ports/json-schema-validator.ts`): validates a built manifest or catalog.
- `contract/build-targets.ts`: the targets and modes presentation names; `BuildNativeTree` (`application/`) is handed in by the composition root.

## Suppliers

- `tools/contract/`: the profile and its `ToolBuildContract`, picked from the catalog in `src/composition/contexts/translate.ts`. `shared/`: errors, `Logger`, file ports, plugin types.

## Rules

- Outside callers import `contract/` and `application/` only.
- The layouts read each profile's `linkSyntax`.
- The engine writes nothing; `DiskSink` writes every artifact kind through the contract and, on top of the engine, rewrites only relative links and the plugin-root token and path.
- A rewrite is proven on a fixture carrying the marker it rewrites.

## Tests

- `tests/contexts/translate/` follows the source folders; `testing/` holds the kit (`engine-kit.builder.ts`, `declared-tool-catalog.builder.ts`, `synthetic-tool-profile.builder.ts`).
- `tests/golden/framework-build.golden.test.ts` freezes a full build per target.

## Exceptions

- Install and `DiskSink` still differ in bytes on what `DIVERGENCES` and `MANIFEST_DIVERGENCES` list in `translate-distribution-conformance.integration.test.ts`: one decision (the `{{TOOLS}}` placeholder, recorded in the CLI architecture decisions) and two open ones (manifest location, manifest content). The list only shrinks.
- `domain/engine.ts` still calls two planners (`buildPlans`, `installPlan`) because the frozen goldens hold different install and build bytes; closes when the owner picks which sink's bytes win and one golden is re-baselined.
