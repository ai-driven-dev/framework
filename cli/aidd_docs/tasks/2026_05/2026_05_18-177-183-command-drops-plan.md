---
plan_id: 177-183-command-drops
objective: Remove 7 redundant CLI command surfaces (folding their behavior into surviving targets) per Phase 1 post-marketplace challenge verdicts. Internal use-case classes that have surviving callers are kept; only orphaned use-cases are deleted.
success_condition: "pnpm test && pnpm typecheck && pnpm knip:production && pnpm lint"
iteration: 0
created_at: 2026-05-18
breaking_changes: true
acceptance_criteria:
  - all 7 commands removed from CLI surface (registrations, menu entries, help output)
  - flag/behavior absorbed by survivor command per recipe below
  - MIGRATION notes capture script-impact recipes in PR body
  - all existing test coverage either preserved (where use-case class stays) or deleted with the dead surface
  - knip clean (no orphan files)
  - pnpm test green
---

## Architecture decisions

### D1 — PluginAddUseCase and PluginPickUseCase: keep as internal helpers

`PluginAddUseCase` is called by `PluginInstallFromMarketplaceUseCase` (plugin install
pipeline) and must not be deleted.

`PluginPickUseCase` is called by `SetupPluginsPromptUseCase` (setup wizard interactive
path) and must not be deleted.

Only their CLI command registrations are removed. Their unit tests and `deps.ts` wiring
stay. Knip remains clean because both classes have surviving importers.

### D2 — plugin install routing: introduce PluginInstallUseCase orchestrator

Rule `0-command-thin-wrapper.md` forbids multiple use-case calls per action. The fused
`plugin install` command must route between three paths (picker / local-add / marketplace),
which requires a thin orchestrator use-case.

New file: `src/application/use-cases/plugin/plugin-install-use-case.ts`
- No-args + interactive → delegates to `PluginPickUseCase`
- No-args + non-interactive → throws `InteractiveOnlyError`
- Source-looking arg (`://`, leading `/` or `./`) → delegates to `PluginAddUseCase`
- Name/name@version arg → delegates to `PluginInstallFromMarketplaceUseCase`

Source-detection rule (from challenge doc): arg contains `://` OR starts with `/` or `./` → treat as source.

The command action keeps its thin-wrapper contract; routing logic lives in the new use-case.

### D3 — marketplace refresh --force: additional cache-dir wipe only

Today's `marketplace refresh` already passes `forceRefresh: true` unconditionally to the
fetcher (no behavior change). Adding `--force` introduces an explicit cache-directory wipe
step via `MarketplaceCacheAdapter.clear(name?)` before re-fetching. Plain refresh keeps its
current behavior unchanged. `--force` clears then re-fetches.

### D4 — marketplace browse → list: delete MarketplaceBrowseUseCase, extend list use-case

`MarketplaceBrowseUseCase` has no callers other than `marketplace.ts` and `menu.ts`.
It is deleted. `MarketplaceListUseCase` gains an optional `withCatalogs: boolean` option
that iterates registered marketplaces, fetches each catalog via `FetchMarketplaceSourceUseCase`
and `PluginCatalogRepository`, and returns entries inline.

The `--plugins` flag on `marketplace list` sets `withCatalogs: true`.

## Phases

### Phase 1 — Pure command drops: plugin status (#181), plugin sync (#182), plugin restore (#183)

These three are pure CLI surface deletions. The use-cases (`StatusUseCase`,
`SyncPluginsUseCase`, `RestorePluginUseCase`) are the actual business logic and are
re-used (or deleted) as follows:

**plugin status (#181):**
- `StatusUseCase` is the global status engine and is already used by `status.ts`, `ai.ts`,
  `ide.ts`. It stays.
- Remove only: `.command("status")` from `plugin.ts`, the menu entry `plugin-status` from
  `menu.ts`, and the E2E test `it("plugin status exits 0…")` in `command-matrix-plugin.e2e.test.ts`
  (line 111). Replace with an equivalent assertion under `status` (global) coverage.
- No use-case file deleted. No unit test deleted.

**plugin sync (#182):**
- `SyncPluginsUseCase` has one caller: `plugin.ts` command. After deletion it is orphaned.
  Delete the use-case file and its imports.
- `ai sync` (`sync-use-case.ts`) already covers cross-tool plugin propagation via
  `SyncAllUseCase` / `SyncFilePropagationUseCase`. Verify `sync-use-case.ts` delegates
  correctly.
- Remove: `.command("sync")` from `plugin.ts`, the menu entry `plugin-sync` from `menu.ts`,
  `SyncPluginsUseCase` import from `plugin.ts`.
- Delete: `src/application/use-cases/sync/sync-plugins-use-case.ts`.
- Delete: `tests/application/use-cases/sync-plugin.unit.test.ts`.
- E2E impacts:
  - `tests/e2e/command-matrix-plugin.e2e.test.ts` line 214: delete the `plugin sync` test.
  - `tests/e2e/sync-matrix.e2e.test.ts` lines 103-108: rewrite to use `ai sync --source S --target T` instead of `plugin sync`.
  - `tests/e2e/sync-plugins.e2e.test.ts` line 145: `plugin add` used as setup helper — see Phase 3.

**plugin restore (#183):**
- `RestorePluginUseCase` has one caller: `plugin.ts` command. After deletion it is orphaned.
  Delete the use-case file. `ai restore` covers plugin restoration via `RestoreAllUseCase`.
- Remove: `.command("restore")` from `plugin.ts`, the menu entry `plugin-restore` from `menu.ts`.
- Delete: `src/application/use-cases/restore/restore-plugin-use-case.ts`.
- Delete: `tests/application/use-cases/restore-plugin.unit.test.ts`.
- E2E impacts:
  - `tests/e2e/command-matrix-plugin.e2e.test.ts` line 166: rewrite `plugin restore` test
    as an `ai restore` equivalent (add plugin, corrupt a file, run `ai restore`, verify).

Files touched in Phase 1:
- `src/application/commands/plugin.ts` (remove 3 command registrations + imports)
- `src/application/commands/menu.ts` (remove 3 menu entries)
- `src/application/use-cases/sync/sync-plugins-use-case.ts` (delete)
- `src/application/use-cases/restore/restore-plugin-use-case.ts` (delete)
- `tests/application/use-cases/sync-plugin.unit.test.ts` (delete)
- `tests/application/use-cases/restore-plugin.unit.test.ts` (delete)
- `tests/e2e/command-matrix-plugin.e2e.test.ts` (edit: delete 2 tests, rewrite 1)
- `tests/e2e/sync-matrix.e2e.test.ts` (edit: rewrite 1 test)

Validation: `pnpm test` after Phase 1 completes.

---

### Phase 2 — marketplace browse → list --plugins (#177)

**Decision D4 applies.**

New `MarketplaceListUseCase` interface:
```
interface MarketplaceListOptions {
  projectRoot: string;
  withCatalogs?: boolean;  // new
}
interface MarketplaceListResult {
  marketplaces: readonly Marketplace[];
  catalogs?: Map<string, PluginCatalog>;  // populated only when withCatalogs=true
}
```
The use-case needs `PluginCatalogRepository` and `FetchMarketplaceSourceUseCase` injected
only when `withCatalogs` is used. Constructor gains both deps (nullable guard inside).

Command `marketplace list --plugins` passes `withCatalogs: true`. Output loop prints catalog
entries per marketplace in the same format as current `browse`:
`${entry.name}@${entry.version} — ${entry.description} — ${describePluginSource(entry.source)}${flag}`.

If `--plugins` is passed but a marketplace catalog fetch fails, use `output.warn()` and
continue (same resilience as `refresh`).

Files touched:
- `src/application/commands/marketplace.ts` (add `--plugins` to list; delete `.command("browse"...)` block; delete `MarketplaceBrowseUseCase` import)
- `src/application/commands/menu.ts` (delete `marketplace-browse` leaf; delete `marketplace-cache` branch entirely)
- `src/application/use-cases/marketplace/marketplace-list-use-case.ts` (extend with `withCatalogs`)
- `src/application/use-cases/marketplace/marketplace-browse-use-case.ts` (delete)
- `src/infrastructure/deps.ts` (delete `marketplaceBrowseUseCase` from Deps interface, factory, and object literal; delete import)
- `tests/application/use-cases/marketplace/marketplace-browse-use-case.unit.test.ts` (delete)
- `tests/application/use-cases/marketplace/marketplace-list-use-case.unit.test.ts` (update: add tests for `--plugins` path)
- `tests/e2e/plugin-install.e2e.test.ts` lines 143-170 (rewrite: replace `marketplace browse local` invocation with `marketplace list --plugins`, update assertions)
- `tests/e2e/command-matrix-help.e2e.test.ts` line 106 (update: remove `expect(stdout).toContain("browse")`; optionally add `.not.toContain("browse")`)

Validation: `pnpm test` after Phase 2 completes.

---

### Phase 3 — marketplace cache → refresh --force (#178)

**Decision D3 applies.**

Add `--force` flag to `marketplace refresh [name]`:
```
.option("--force", "Clear cache before re-fetching")
```

When `--force` is set:
1. Instantiate `MarketplaceCacheAdapter(projectRoot)`.
2. If `name` given: `adapter.clear(name)`.
3. If no name: `adapter.clear()` (all).
4. Then proceed with normal refresh.

All cache logic stays inside the command action (no new use-case needed — it's a pre-step
before calling the existing `marketplaceRefreshUseCase`). This is the only phase where
`MarketplaceCacheAdapter` is directly instantiated in a command (it already is in `cache`
sub-commands today, so precedent exists).

After adding `--force`, delete the `cache` sub-command group entirely.

Files touched:
- `src/application/commands/marketplace.ts` (add `--force` to refresh action; delete the `cache` sub-command group and both `MarketplaceCacheClearUseCase`/`MarketplaceCacheListUseCase` imports)
- `src/application/use-cases/marketplace/marketplace-cache-clear-use-case.ts` (delete)
- `src/application/use-cases/marketplace/marketplace-cache-list-use-case.ts` (delete)
- `tests/e2e/command-matrix-plugin.e2e.test.ts` lines 269, 285, 301 (delete 3 cache tests; add 1 `refresh --force` smoke test)

Note: `MarketplaceCacheAdapter` and `MarketplaceCachePort` are NOT deleted — they remain
infrastructure for the `--force` path and potentially future use. Knip must confirm.

Validation: `pnpm test` after Phase 3 completes.

---

### Phase 4 — plugin add → install (source-detection) + plugin pick → install no-args (#179, #180)

**Decision D1 (keep PluginAddUseCase/PluginPickUseCase) and D2 (orchestrator) apply.**

#### New file: `src/application/use-cases/plugin/plugin-install-use-case.ts`

```typescript
export interface PluginInstallOptions {
  pluginArg: string | undefined;
  toolIds: AiToolId[] | "all";
  projectRoot: string;
  interactive: boolean;
  fromMarketplace?: string;
  token?: string;
  yes?: boolean;
}
export interface PluginInstallResult {
  kind: "picked" | "local" | "marketplace";
  installed: readonly string[];
}
```

Routing logic (all inside `execute()`):
- `pluginArg === undefined` → no-args path:
  - if not `interactive`: throw `InteractiveOnlyError("plugin install")`
  - else: delegate to `PluginPickUseCase` → return `{ kind: "picked", installed: result.installed }`
- `pluginArg` looks like a source (contains `://` OR starts with `/` or `./`):
  - parse via `parsePluginSourceShorthand`
  - delegate to `PluginAddUseCase`
  - return `{ kind: "local", installed: [parsed name from distribution] }`
- otherwise:
  - parse via `parsePluginSpec` (name@version)
  - delegate to `PluginInstallFromMarketplaceUseCase`
  - return `{ kind: "marketplace", installed: [entry.name] }`

#### Command change: `plugin install`

Current signature: `install <plugin>` (required positional).
New signature: `install [plugin]` (optional positional).

Command action calls `deps.pluginInstallUseCase.execute({...})`. Display switches on `result.kind`.

#### deps.ts changes

Add `pluginInstallUseCase: PluginInstallUseCase` to `Deps` interface and factory.
Wire it with `PluginPickUseCase`, `PluginAddUseCase`, `PluginInstallFromMarketplaceUseCase`.
Keep `pluginAddUseCase` and `pluginPickUseCase` in `Deps` (still used by other callers).

#### Delete: plugin add and plugin pick command registrations

Remove `.command("add"...)` and `.command("pick"...)` from `plugin.ts`.
Remove menu entries `plugin-add` and `plugin-pick` from `menu.ts`.

#### E2E migration — commands using `plugin add` as a test helper

`plugin add` is used as a setup helper in several E2E files. Since `plugin install <path>`
will be the new surface for local source install, these can use `plugin install <path>`
instead:
- `tests/e2e/command-matrix-plugin.e2e.test.ts` lines 49-232: all `plugin add` → `plugin install`
- `tests/e2e/sync-plugins.e2e.test.ts` lines 147, 152: `plugin add <path>` → `plugin install <path>`

#### Test files

- `tests/application/use-cases/plugin/plugin-add-use-case.unit.test.ts` — KEEP (class stays)
- `tests/application/use-cases/plugin/plugin-pick-use-case.unit.test.ts` — KEEP (class stays)
- New file: `tests/application/use-cases/plugin/plugin-install-use-case.unit.test.ts`
  (covers routing: no-args-TTY → pick, no-args-non-TTY → error, source-arg → add, name-arg → marketplace)
- `tests/e2e/command-matrix-help.e2e.test.ts` line 88: remove `expect(stdout).toContain("add")`
  (or convert to `.not.toContain("add")` if needed)
- `tests/e2e/command-matrix-plugin.e2e.test.ts` line 202: rewrite `plugin pick non-interactive` →
  `plugin install` no-args non-interactive (same expectation: exit 1, contains "interactive")

Files touched in Phase 4:
- `src/application/commands/plugin.ts` (remove `add`/`pick` registrations; update `install` to `[plugin]` optional; switch to `pluginInstallUseCase`)
- `src/application/commands/menu.ts` (delete `plugin-add`, `plugin-pick` entries; rename "Install from marketplace" to "Install plugin")
- `src/application/use-cases/plugin/plugin-install-use-case.ts` (new)
- `src/infrastructure/deps.ts` (add `pluginInstallUseCase`)
- `tests/application/use-cases/plugin/plugin-install-use-case.unit.test.ts` (new)
- `tests/e2e/command-matrix-plugin.e2e.test.ts` (edit: all `plugin add` → `plugin install`; rewrite pick non-interactive)
- `tests/e2e/sync-plugins.e2e.test.ts` (edit: 2 `plugin add` invocations → `plugin install`)
- `tests/e2e/command-matrix-help.e2e.test.ts` (edit: remove `add` assertion from plugin help)

Validation: `pnpm test && pnpm typecheck` after Phase 4 completes.

---

### Phase 5 — Final validation and knip clean

Run full validation suite:
```
pnpm test && pnpm typecheck && pnpm knip:production && pnpm lint
```

Expected knip orphans after all phases:
- `marketplace-browse-use-case.ts` (deleted in Phase 2)
- `sync-plugins-use-case.ts` (deleted in Phase 1)
- `restore-plugin-use-case.ts` (deleted in Phase 1)
- `marketplace-cache-clear-use-case.ts` (deleted in Phase 3)
- `marketplace-cache-list-use-case.ts` (deleted in Phase 3)

Knip should NOT flag:
- `PluginAddUseCase` (called by `PluginInstallFromMarketplaceUseCase` and `PluginInstallUseCase`)
- `PluginPickUseCase` (called by `SetupPluginsPromptUseCase` and `PluginInstallUseCase`)
- `MarketplaceCacheAdapter` (used by `marketplace refresh --force` path)
- `MarketplaceCachePort` (implemented by `MarketplaceCacheAdapter`)

---

## Rules table

| Rule | Source | Application |
|---|---|---|
| One use-case per command action | `0-command-thin-wrapper.md` | New `PluginInstallUseCase` orchestrator for Phase 4 |
| Commands wire, not orchestrate | `0-command-thin-wrapper.md` | Routing moves into `PluginInstallUseCase`, not command action |
| Delete dead code | `7-clean-code.md` | Delete use-case files that have no remaining callers |
| Keep internal helpers | D1 | `PluginAddUseCase`, `PluginPickUseCase` remain in source + deps |
| Adapters translate, use-cases orchestrate | `0-hexagonal.md` | `MarketplaceCacheAdapter` instantiated in command action only for `--force` pre-step |
| Test pyramid | `5-test-pyramid.md` | Delete E2E tests for removed commands; add unit tests for new orchestrator |

---

## Risks

**R1 — PluginPickUseCase kept but its command is removed.**
Two call sites after the PR: `SetupPluginsPromptUseCase` (setup wizard) and `PluginInstallUseCase`
(no-args TTY path). Both must remain green. Guard: `greenfield-setup.e2e.test.ts` is the
setup-wizard E2E anchor. Do not modify it; verify it stays green after Phase 4.

**R2 — SyncPluginsUseCase deletion vs ai sync coverage.**
`plugin sync` delegated to `SyncPluginsUseCase` which is a thin wrapper around
`PluginInstallFromMarketplaceUseCase`. `ai sync` uses `SyncAllUseCase` → `SyncUseCase` →
`SyncFilePropagationUseCase`. Semantic equivalence must be confirmed before deleting the
unit test. Check: does `ai sync` propagate marketplace plugins across tools? Confirm yes
from `sync-use-case.ts` and `sync-plugins.e2e.test.ts`.

**R3 — sync-matrix.e2e.test.ts uses `plugin sync` as the action under test.**
This entire E2E scenario must be migrated to `ai sync`. The setup (install, marketplace register,
plugin install) stays the same; only the propagation call changes to `ai sync --source S --target T`.

**R4 — E2E tests using `plugin add` as setup (not test subject).**
Phase 4 switches all `plugin add` invocations to `plugin install`. The `plugin install <path>`
must handle local path sources correctly (Decision D2 source-detection). Verify the routing
path in `PluginInstallUseCase` for source args covers all fixture paths used in tests
(`tests/fixtures/plugins/claude-format/sample-plugin` — absolute path).

**R5 — marketplace list --plugins fetches all catalogs on every call.**
Potential performance regression if many marketplaces are registered. Out of scope for this
PR (no `--no-fetch` optimization). Acceptable for MVP.

**R6 — MarketplaceCacheAdapter wired inline in command (Phase 3).**
This breaks the `createDeps` memoization pattern for that one pre-step. Acceptable per
current `cache` command precedent (same pattern already exists).

---

## Migration notes (for PR body)

| Old command | New equivalent |
|---|---|
| `aidd marketplace browse <name>` | `aidd marketplace list --plugins` |
| `aidd marketplace cache list` | (dropped — no equivalent; use `marketplace refresh` to re-fetch) |
| `aidd marketplace cache clear [name]` | `aidd marketplace refresh [name] --force` |
| `aidd marketplace cache clear --all` | `aidd marketplace refresh --force` |
| `aidd plugin add <source>` | `aidd plugin install <source>` |
| `aidd plugin pick` | `aidd plugin install` (no args, requires TTY) |
| `aidd plugin status` | `aidd status` |
| `aidd plugin sync --source S --target T` | `aidd ai sync --source S --target T` |
| `aidd plugin restore --plugin <name>` | `aidd ai restore` |

---

## Test plan

- Phase 1: `pnpm test` — assert sync-plugin and restore-plugin unit tests gone; sync-matrix
  E2E rewritten to `ai sync`; status E2E preserved under global status
- Phase 2: `pnpm test` — assert browse unit test gone; list unit test covers `--plugins`; 
  plugin-install E2E rewritten to `list --plugins`
- Phase 3: `pnpm test` — assert cache E2E tests removed; refresh --force smoke test passes
- Phase 4: `pnpm test` — assert `plugin install <path>` works; `plugin install <name>` works;
  `plugin install` no-args non-interactive exits 1; setup E2E (`greenfield-setup.e2e.test.ts`) green
- Final: `pnpm test && pnpm typecheck && pnpm lint && pnpm knip:production` — all green
