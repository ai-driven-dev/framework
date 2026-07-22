# Phase 7 — Manifest schema rewrite + `docsDir` hardcode

> Hardcode `"aidd_docs"` constant at all 13 call sites. Drop manifest fields: `docs`, `scripts`, `plugins` (top-level), `repo`, `docsDir`, `mode`. Add `marketplaces` aggregate child. Update migration chain `migrateV4toV5`. Manifest schema reaches its final v5 clean form (in-place rework, never published stable).

## Pre-requisites

- Phase 5 (framework plugins legacy purge) landed — `addScripts`/`addPlugins`/`clearScripts`/`clearPlugins` mutators removed
- Phase 6 (manifest repo + config purge) landed — `manifest.repo` field + callers cleared

## Goal

Phase 0 inventory listed 13 direct `manifest.docsDir` reads across 9 files. The `docsDir` field is read-only and hardcoded to `"aidd_docs"` per locked decision #10. Phase 7 replaces every read with a hardcoded constant, then deletes the field. Simultaneously, the schema reaches its final v5 clean form: only `tools{}` and `marketplaces{}` survive at top level.

This is the most invasive single phase by reach — 13 files touched for the docsDir hardcode + the schema rewrite — so it lands as one atomic commit to keep the migration chain coherent.

## Architecture compliance

`Manifest` aggregate post Phase 7 has exactly two child collections: `tools` (per-tool entries with nested plugins) and `marketplaces` (registered sources). All other fields gone.

`MarketplaceEntry` becomes a proper value object with readonly fields, ctor validation, and `.equals()`.

Migration chain stays domain-pure: `migrateV1toV2 → migrateV2toV3 → migrateV3toV4 → migrateV4toV5`. The `migrateV4toV5` step strips dead fields and initializes `marketplaces: {}` if absent. v5 is reworked in place since never shipped stable.

`ToolEntry` enriched: `plugins[]` becomes the only plugin tracking location. Each `PluginEntry` gains `marketplace: string | null` field (Phase 1 manifest part already documented this).

Domain pure rule: `Manifest` and value objects stay free of `node:fs`, `application/`, `infrastructure/`.

## Steps

### A. Hardcode `"aidd_docs"` at every call site

Every file below currently reads `manifest.docsDir` and must instead reference a single shared constant. Create `DOCS_DIR` in a domain-pure location.

- [ ] Create `src/domain/models/paths.ts` (if not already exists) export: `export const DOCS_DIR = "aidd_docs" as const;`
- [ ] Replace `manifest.docsDir` reads at:
  - [ ] `src/application/use-cases/clean-use-case.ts:84,86`
  - [ ] `src/application/use-cases/install/install-use-case.ts:136` (already deleted Phase 2 — verify)
  - [ ] `src/application/use-cases/install/install-ide-config-use-case.ts:50`
  - [ ] `src/application/use-cases/install/install-runtime-config-use-case.ts:49`
  - [ ] `src/application/use-cases/uninstall-use-case.ts:66`
  - [ ] `src/application/use-cases/uninstall-ide-use-case.ts:34`
  - [ ] `src/application/use-cases/plugin/plugin-add-use-case.ts:45`
  - [ ] `src/application/use-cases/plugin/plugin-update-use-case.ts:37`
  - [ ] `src/application/use-cases/doctor-use-case.ts:132`
  - [ ] `src/application/use-cases/sync/sync-use-case.ts:183`
  - [ ] `src/application/use-cases/restore/restore-plugin-use-case.ts:39`
  - [ ] `src/application/commands/restore.ts:123`
  - [ ] `src/application/commands/config.ts:27,62` (already deleted Phase 6 — verify)
- [ ] Verify `rg "manifest\.docsDir|getDocsDir" src/` returns empty

### B. Add `MarketplaceEntry` value object

- [ ] Create `src/domain/models/marketplace-entry.ts`:
  - Readonly fields: `name: string`, `source: PluginSource`, `scope: "project" | "user"`, `lastRefreshAt?: Date`
  - Constructor validates: name non-empty, scope is `"project"` or `"user"`
  - `.equals(other)` compares all fields
  - `.serialize()`, `MarketplaceEntry.deserialize(data)` static
- [ ] Unit tests in `tests/domain/models/marketplace-entry.unit.test.ts`

### C. Rewrite `Manifest` schema in `src/domain/models/manifest.ts`

- [ ] Update `ManifestData` interface to final shape:
  ```ts
  interface ManifestData {
    version: 5;
    tools: Record<ToolId, ToolEntryData>;
    marketplaces: Record<string, MarketplaceEntryData>;
  }
  ```
- [ ] Remove from `ManifestData`: `docsDir`, `repo`, `mode`, `docs`, `scripts`, top-level `plugins`
- [ ] Remove from `Manifest` class: `docsDir` field, `validateDocsDir()`, `DEFAULT_DOCS_DIR` constant
- [ ] Remove READ accessors `getScriptsFiles`, `getScriptsVersion`, `hasScripts`, `getPluginsFiles`, `getPluginsVersion`, `hasPlugins` (Phase 8 migrate has already consumed legacy data via raw JSON inspection by this point)
- [ ] Add `_marketplaces: Map<string, MarketplaceEntry>` private field
- [ ] Add aggregate methods:
  - [ ] `addMarketplace(entry: MarketplaceEntry): void` — throws `DuplicateMarketplaceError` on name collision
  - [ ] `removeMarketplace(name: string): void`
  - [ ] `getMarketplace(name: string): MarketplaceEntry | undefined`
  - [ ] `listMarketplaces(): readonly MarketplaceEntry[]`
  - [ ] `hasMarketplace(name: string): boolean`
- [ ] Update `Manifest.create()` to take no params (no docsDir, no repo)
- [ ] Update `serialize()` to emit only `version`, `tools`, `marketplaces`
- [ ] Update `deserialize()` to parse new shape; ignore stale legacy fields silently

### D. Update migration chain

- [ ] Rewrite `migrateV4toV5(raw)` to strip `docs`, `scripts`, top-level `plugins`, `mode`, `repo`, `docsDir`; initialize `marketplaces: {}` if absent
- [ ] Keep `migrateV1toV2`, `migrateV2toV3`, `migrateV3toV4` unchanged for chain integrity
- [ ] Verify `MANIFEST_VERSION` constant stays `5`

### E. Update `Plugin` value object

- [ ] In `src/domain/models/plugin.ts`: ensure `marketplace: string | null` field exists (per Phase 1 design)
- [ ] If absent, add it; update ctor validation; update `.serialize`/`.deserialize`
- [ ] Update unit tests

### F. Update repository adapter

- [ ] `src/infrastructure/adapters/manifest-repository-adapter.ts`: ensure read/write of new shape works
- [ ] Verify backup write path (used by Phase 8 migrate) writes to `.aidd/manifest.backup.json` atomically

### G. Update fixtures

- [ ] Snapshot any production-shape fixture in `tests/fixtures/manifests/legacy-v3/` and `legacy-v4/` for migration tests
- [ ] Regenerate `tests/fixtures/manifests/v5/` with new clean shape
- [ ] Remove fixtures that referenced dead fields (or mark as legacy migration tests)

## Tests

### Unit tests

- [ ] `tests/domain/models/manifest.unit.test.ts`:
  - [ ] `Manifest.create()` produces empty aggregate (no docsDir, no repo)
  - [ ] `addMarketplace()` rejects duplicate name
  - [ ] `removeMarketplace()` removes by name
  - [ ] `addTool()` enforces hash format on every TrackedFile
  - [ ] Plugin uniqueness within tool enforced
  - [ ] Cross-tool plugin uniqueness NOT enforced
  - [ ] `serialize()` round-trip identity
  - [ ] `serialize()` does NOT emit `docs`, `scripts`, `mode`, `repo`, `docsDir`, top-level `plugins`
  - [ ] `deserialize(legacyV3)` invokes migration chain v3→v5
  - [ ] `deserialize(legacyV4)` invokes v4→v5
  - [ ] `deserialize(unknownVersion)` throws
- [ ] `tests/domain/models/manifest-migration.unit.test.ts`:
  - [ ] `migrateV4toV5` strips all dead fields, initializes marketplaces
  - [ ] Chain idempotent on already-v5 input
- [ ] `tests/domain/models/marketplace-entry.unit.test.ts`

### Integration tests

- [ ] `tests/infrastructure/adapters/manifest-repository.integration.test.ts`:
  - [ ] Read legacy v3 fixture → deserialize → schema is v5 in memory
  - [ ] Save v5 manifest → reload → bytes-identical

### E2E tests

- None for Phase 7 (covered Phase 12 main journeys)

## Acceptance criteria

- [ ] `pnpm test` green
- [ ] `pnpm typecheck` clean
- [ ] `pnpm biome check` clean
- [ ] `rg "manifest\.docsDir|getDocsDir|DEFAULT_DOCS_DIR|validateDocsDir" src/` returns empty
- [ ] `rg "addScripts|getScriptsFiles|hasScripts|clearScripts|addPlugins\b|clearPlugins\b|getPluginsFiles\b|hasPlugins\b" src/` returns empty
- [ ] No method >20 lines in `manifest.ts`
- [ ] Domain pure: `rg "from \"\.\./\.\./application|node:fs|process\.env" src/domain/models/manifest.ts` returns empty
- [ ] Greenfield manifest output contains only `version`, `tools`, `marketplaces` keys at top level

## Manual validation

```bash
cd /tmp && rm -rf phase7-test && mkdir phase7-test && cd phase7-test
aidd setup --source remote --ai claude --no-plugins --yes

# Verify manifest top-level keys
cat .aidd/manifest.json | jq 'keys'
# expect: ["marketplaces","tools","version"]

# Verify version
cat .aidd/manifest.json | jq .version
# expect: 5

# Forbidden fields
cat .aidd/manifest.json | jq 'has("docs"), has("scripts"), has("docsDir"), has("repo"), has("mode"), has("plugins")'
# expect: false × 6
```

## Risks / breaking changes

- Removing READ accessors (`getScriptsFiles`, `getPluginsFiles`, `hasScripts`, `hasPlugins`) means any caller still using them post-Phase 5 breaks. Phase 5 cleared the writers; Phase 8 migrate must inspect raw JSON before deserialize. Verify Phase 8 migrate uses raw JSON inspection (not `Manifest` accessors) for legacy data detection — that's the contract.
- Fixtures regenerate breaks tests using outdated shape. Inventory before Phase 7 lists all fixture paths.
- Production users on v3/v4 see automatic strip on next CLI invocation (deserialize chain runs). No data loss for installed-tool tracking.

## Commit

```
refactor(manifest): final v5 schema — strip dead fields + marketplaces aggregate

Hardcode "aidd_docs" constant at 13 docsDir read sites (9 files).
Drop manifest fields: docs, scripts, plugins (top-level), repo, docsDir, mode.
Add MarketplaceEntry value object + Manifest.marketplaces aggregate child.

Migration chain v3→v4→v5 retained; v5 reworked in place (never shipped stable).
migrateV4toV5 strips dead fields and initializes marketplaces if absent.

Final schema:
  { version: 5, tools: {...}, marketplaces: {...} }

Plugin tracking nested under tools[id].plugins[]. No top-level plugin section.

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-7.md
```
