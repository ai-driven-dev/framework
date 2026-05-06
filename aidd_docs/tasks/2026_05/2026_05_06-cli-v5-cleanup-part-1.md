# Phase 1 — Manifest v5 schema rewrite (in place)

> Drop dead fields from Manifest aggregate root. Rework v5 in place since not yet stable. Migration chain v3→v4→v5 retained for brownfield compatibility.

## Pre-requisites

- Phase 0 inventory complete and committed
- All callers of dead fields documented in `2026_05_06-cli-v5-cleanup-part-0-inventory.md`

## Goal

Manifest is the **aggregate root** of installed state. Today it carries dead baggage from prior architectures (`docs`, `scripts`, `plugins` top-level, `repo`, `docsDir`, `mode`). Phase 1 makes Manifest reflect the marketplace-only architecture exactly: tools own their files + plugins; marketplaces declared separately; nothing else.

## Architecture compliance

- `Manifest` stays **non-anemic**: invariant checks live on the entity (e.g. plugin uniqueness per tool, file path uniqueness per tool, MD5 hash format validation)
- Value objects: `ToolEntry`, `PluginEntry`, `MarketplaceEntry`, `TrackedFile`, `MergeFileEntry`, `McpExclusion` — all `readonly`, validated in constructor, `.equals()` where used in collections
- Migration functions stay pure (no I/O, no logging) — receive `Record<string, unknown>` and mutate in place
- Domain stays import-pure: zero `node:fs`, zero `application/`, zero `infrastructure/`
- New `MarketplaceEntry` value object lives in `src/domain/models/manifest.ts` (or extracted to `src/domain/models/marketplace-entry.ts` if file size demands)

## Target schema

```ts
const MANIFEST_VERSION = 5;

interface ManifestData {
  version: 5;
  tools: Record<ToolId, ToolEntryData>;
  marketplaces: Record<string, MarketplaceEntryData>;
}

interface ToolEntryData {
  toolId: ToolId;
  version: string;
  files: TrackedFileData[];
  mergeFiles?: MergeFileEntryData[];
  excludedMcp?: McpExclusionData[];
  plugins?: PluginEntryData[];
}

interface PluginEntryData {
  name: string;
  version: string;
  source: PluginSourceData;
  marketplace: string | null;   // null = local plugin (added via `plugin add`)
  files: TrackedFileData[];
}

interface MarketplaceEntryData {
  name: string;
  source: PluginSourceData;
  scope: "project" | "user";
  lastRefreshAt?: string;       // ISO-8601
}
```

Removed fields (all dead in v5):
- `docsDir` — hardcoded `aidd_docs` per lock #10 of `2026_05_01`
- `repo` — replaced by marketplace registration
- `mode` — replaced by `MarketplaceEntry.source` type
- `docs` (already removed v4→v5)
- `scripts` — never written in marketplace-only flow
- `plugins` (top-level) — plugins live nested under `tools[id].plugins[]`

## Steps

- [ ] Snapshot fixtures: copy current `tests/fixtures/manifests/*.json` to `tests/fixtures/manifests/legacy-v3/` and `legacy-v4/` for migration tests
- [ ] Rewrite `src/domain/models/manifest.ts`:
  - [ ] Drop `_scripts`, `_plugins` (top-level), `_mode`, `docsDir`, `repo` private fields
  - [ ] Drop methods: `addScripts`, `getScriptsFiles`, `getScriptsVersion`, `hasScripts`, `clearScripts`, `addPlugins`, `clearPlugins`, `getPluginsVersion`, `hasPlugins`, `getPluginsFiles`, `getMode`, `setMode`, `withRepo`, `validateDocsDir`, `DEFAULT_DOCS_DIR`, `DEFAULT_REPO`
  - [ ] Drop `validateRepoFormat` export
  - [ ] Add `_marketplaces: Map<string, MarketplaceEntry>` private field
  - [ ] Add aggregate methods: `addMarketplace(entry)`, `removeMarketplace(name)`, `getMarketplace(name)`, `listMarketplaces()`, `hasMarketplace(name)`
  - [ ] Update `Manifest.create()` to no longer accept `docsDir`/`repo` params
  - [ ] Update `serialize()` to emit new `ManifestData` shape (no `docs`/`scripts`/`mode`/`repo`/`docsDir`/top-level `plugins`)
  - [ ] Update `deserialize()` to parse new shape
- [ ] Rewrite `migrateV4toV5(raw)` to also drop: `mode`, `scripts`, top-level `plugins`, `repo`, `docsDir`
- [ ] Keep migration chain calls intact: `migrateV1toV2 → migrateV2toV3 → migrateV3toV4 → migrateV4toV5`
- [ ] If `marketplaces` field absent in legacy data, initialize `marketplaces: {}` in `migrateV4toV5`
- [ ] Update `Manifest` aggregate invariants: throw `ManifestValidationError` on unknown fields (unless from migration shim)
- [ ] Verify `MergeFileEntry` and `McpExclusion` value objects unchanged (still belong to ToolEntry)
- [ ] Update `Plugin` value object to require `marketplace: string | null` field (was implicit before)
- [ ] Bump no version constant (stays 5)
- [ ] Update `src/infrastructure/adapters/manifest-repository-adapter.ts` to expose new field reads (`marketplaces`)

## Tests (unit-first)

### Unit tests (`tests/domain/models/manifest.unit.test.ts`)

- [ ] `Manifest.create()` produces empty aggregate (no docsDir, no repo)
- [ ] `addMarketplace()` rejects duplicate name (throw `DuplicateMarketplaceError`)
- [ ] `removeMarketplace()` removes by name + cascades plugin orphan check (depends on lock #4 of `2026_05_01`)
- [ ] `addTool()` enforces hash format on every `TrackedFile`
- [ ] Plugin uniqueness within tool enforced (throws `DuplicatePluginError`)
- [ ] Cross-tool plugin uniqueness NOT enforced (same plugin can install on multiple tools)
- [ ] `serialize()` round-trip with `deserialize()` is identity
- [ ] `serialize()` does NOT emit `docs`, `scripts`, `mode`, `repo`, `docsDir`, top-level `plugins`
- [ ] `deserialize(legacyV3Data)` invokes migration chain v3→v4→v5
- [ ] `deserialize(legacyV4Data)` invokes v4→v5 only
- [ ] `deserialize(unknownVersion)` throws
- [ ] Legacy field stripping: input contains `docs/scripts/mode/repo/docsDir/topPlugins`, output schema clean

### Migration unit tests (`tests/domain/models/manifest-migration.unit.test.ts`)

- [ ] `migrateV1toV2(rawV1)` moves vscode-tracked files (existing behavior preserved)
- [ ] `migrateV2toV3(rawV2)` initializes `tools[*].plugins ??= []`
- [ ] `migrateV3toV4(rawV3)` adds `mode = "local"` and `plugins: null` (legacy behavior preserved for chain integrity)
- [ ] `migrateV4toV5(rawV4)` drops `docs`, `scripts`, top-level `plugins`, `mode`, `repo`, `docsDir`, initializes `marketplaces: {}` if absent
- [ ] Full chain idempotent on already-v5 input

### Integration tests (`tests/infrastructure/adapters/manifest-repository.integration.test.ts`)

- [ ] Read legacy v3 fixture from disk → deserialize → schema is v5 in memory
- [ ] Save v5 manifest → reload → bytes-identical
- [ ] Backup file `.aidd/manifest.backup.json` writable (used by Phase 4 migrate)

### E2E tests

- None for Phase 1 — schema changes covered by unit + integration. E2E only at Phase 11 main journeys.

## Acceptance criteria

- [ ] All unit tests pass (`pnpm test tests/domain/models/manifest`)
- [ ] All integration tests pass (`pnpm test tests/infrastructure/adapters/manifest-repository`)
- [ ] `pnpm typecheck` clean — no `any`, no unused exports
- [ ] `pnpm biome check src/domain/models/manifest.ts` clean
- [ ] No method >20 lines (extract helpers if needed)
- [ ] Domain pure: `rg "from \"\.\./\.\./application|from \"\.\./\.\./infrastructure|node:fs|process\.env" src/domain/models/manifest.ts` returns zero
- [ ] Aggregate invariants enforced: every public mutator validates before mutation
- [ ] Migration chain identity: legacy v3 → migrate → v5 schema preserves all valid file/plugin tracking

## Manual validation

```bash
# 1. Snapshot a v3 fixture, deserialize via aidd, save back
cd /tmp && rm -rf v3-test && mkdir v3-test && cd v3-test
cp /path/to/repo/tests/fixtures/manifests/legacy-v3/manifest.json .aidd/
node -e "
  const { Manifest } = require('@ai-driven-dev/cli/dist/domain/models/manifest.js');
  const raw = require('./.aidd/manifest.json');
  const m = Manifest.deserialize(raw);
  console.log(JSON.stringify(m.serialize(), null, 2));
"

# 2. Verify forbidden fields absent in serialized output
# Output must NOT contain: "docs", "scripts", "mode", "repo", "docsDir", top-level "plugins"
```

## Risks / breaking changes

- All callers of `Manifest.docsDir` / `manifest.repo` / mode methods break. Phase 0 inventory is the safety net.
- Fixtures pinned to legacy schema must be regenerated or labeled `legacy-v3/`, `legacy-v4/` for migration tests.
- Production users on v3 will migrate automatically on next `aidd <any-cmd>` invocation (deserialize chain). Backup written by Phase 4 `migrate` command — Phase 1 does NOT auto-backup since callers may not want it.

## Commit

```
refactor(manifest): rework v5 schema in place — drop dead fields

Drop manifest fields no longer carried by marketplace-only architecture:
- docsDir (hardcoded aidd_docs)
- repo (replaced by marketplace registration)
- mode (replaced by marketplace source type)
- scripts section (unused in marketplace flow)
- top-level plugins section (plugins now nested under tools)

Add marketplaces section as Manifest aggregate child.
Migration chain v3→v4→v5 preserved; v5 reworked since never published stable.

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-1.md
```
