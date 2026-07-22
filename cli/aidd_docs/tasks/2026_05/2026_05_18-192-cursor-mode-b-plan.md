---
plan_id: 192-cursor-mode-b
objective: Migrate Cursor plugin install from Mode A (marketplace registration in .cursor/settings.json) to Mode B (flat file materialization at ~/.cursor/plugins/local/<name>/), covering both the capability declaration change and the infrastructure gap for user-scope path resolution.
success_condition: "pnpm test && pnpm typecheck && pnpm knip:production && pnpm lint"
iteration: 0
created_at: 2026-05-18
acceptance_criteria:
  - aidd ai install cursor triggers Mode B flat materialization for plugins
  - Plugin files materialized at ~/.cursor/plugins/local/<name>/
  - User-scope is the only supported scope for Cursor (project-scope rejected with a clear error)
  - aidd ai status reflects Cursor Mode B installation state (drift detection works on user-level paths)
  - Integration test asserts correct file structure at the user-level path
---

## Decision

### D1: Path resolution strategy — option (a): capability-level install scope declaration

Add `installScope: "project" | "user"` and `userPluginsDir(pluginName): string` to `FlatPluginsParams`
and expose the resolved base path through `PluginsCapability`. The Mode B adapter calls
`plugins.resolvePluginsBaseDir(userHome)` to get the absolute write root, then appends `<name>/`.

Rejected: option (b) (hardcoded per-toolId in adapter). Tool-specific knowledge must live in the tool
definition file, not in the shared adapter. Rule `0-tool-config.md` is explicit: tool files in
`tools/ai/` compose capabilities; shared use-cases must be tool-agnostic. Adding per-toolId branches
to `ModeBFlatMaterializationAdapter` would violate this and couple the adapter to Cursor internals.

Rejected: option (c) (path strategy as a separate capability field). Redundant if `installScope` is
already on `FlatPluginsParams` — a separate strategy object adds indirection without extra clarity.

Concrete change:
- `FlatPluginsParams` gains `installScope?: "project" | "user"` (default `"project"` for back-compat)
  and `userPluginsDir?: (homedir: string) => string` (required when `installScope === "user"`).
- `PluginsCapability` exposes `readonly installScope: "project" | "user"` and
  `resolvePluginsBaseDir(projectRoot: string, homedir: string): string` — returns either the
  project-rooted dir or the user-homedir-rooted dir depending on scope.
- Cursor declares `installScope: "user"`, `userPluginsDir: (h) => join(h, ".cursor", "plugins", "local")`.
- OpenCode keeps the implicit default `installScope: "project"` — no change to its declaration.

### D2: Plugin.files path encoding for user-scope

`Plugin.files` keys are **install-base-relative** strings. For project scope (OpenCode) the base is
`projectRoot`; for user scope (Cursor) the base is `homedir()/<tool-plugins-dir>`. Keys therefore
look like `aidd-context/commands/foo.md` in both cases — no absolute paths stored in the manifest.

Decision: keep keys relative to the install base. Resolve the full absolute write/read path at I/O
time by calling `plugins.resolvePluginsBaseDir(projectRoot, homedir())` to get the base, then using
`join(base, key)`. No change to `Plugin.files` semantics; only the base changes per scope.

Alternative considered: store absolute paths in `Plugin.files`. Rejected — `path.join("/a", "/b")`
returns `/a/b` on Node.js, NOT `/b`. `path.join` never collapses absolute segments; only
`path.resolve` does. Verified: `node -e 'console.log(require("path").join("/proj", "/home/u/.cursor/plugins/local/aidd-context/cmd.md"))'`
→ `/proj/home/u/.cursor/plugins/local/aidd-context/cmd.md`. Storing absolute paths as `Plugin.files`
keys and passing them to `join(projectRoot, key)` would produce doubly-prefixed garbage paths.

Alternative considered: tilde-prefixed sentinels (`~/...`). Rejected — requires expansion logic in
every consumer (StatusUseCase, writePluginFiles, etc.) creating blast radius with no benefit over
the base-resolution approach.

### D3: StatusUseCase — cross-root drift detection

`StatusUseCase.checkOnePluginDrift` currently does `join(projectRoot, relativePath)`. For user-scope
plugins this is wrong — the base is NOT `projectRoot`. `checkOnePluginDrift` must receive the
resolved base dir, not always `projectRoot`.

Concrete change: `checkOnePluginDrift(files, baseDir)` — the caller resolves `baseDir` from the
capability before calling. For project-scope, `baseDir = projectRoot`. For user-scope,
`baseDir = plugins.resolvePluginsBaseDir(projectRoot, homedir())`. Keys in `Plugin.files` remain
relative to `baseDir` in both cases, so `join(baseDir, relativePath)` is always correct.

`StatusUseCase.detectAddedFiles` walks `join(projectRoot, directory)` — it will NOT see user-level
plugin files. That is acceptable: added-file detection for user-scope plugins is silently skipped
(tracked-file drift still works; only unknown-new-file scan is skipped). Document with an inline
comment. Full solution (walk the user plugins dir) deferred as follow-up.

`StatusUseCase` must import `os.homedir` at the call site where it resolves the base dir for user-scope plugins.

### D4: Cross-project manifest collision

Two projects may install the same Cursor plugin: both write to `~/.cursor/plugins/local/<name>/`,
both track the same absolute paths in their respective manifests. On `aidd plugin remove`, each
project independently deletes the user-level files. If project B removes after project A, the
files are gone. This is last-write-wins-delete semantics — the same behavior as a user manually
deleting a file. No reference counting is introduced in this issue. The risk is documented in
the Risks section. A reference-counting solution is deferred.

### D5: Cursor project-scope — reject with error

Cursor's plugin auto-load spec supports only `~/.cursor/plugins/local/` (user-level). There is no
project-scoped equivalent that auto-loads. Sending --scope project to Cursor Mode B would write
files that Cursor never loads — silently broken. Decision: Cursor project-scope is rejected.

Since `--scope` for `aidd plugin install` does not yet exist in the CLI (issue #196 is unmerged),
this issue ships with user-scope only (Cursor always writes to user dir). When #196 adds `--scope`,
a guard must be added: if `toolId === "cursor" && scope === "project"` → throw
`CursorProjectScopeUnsupportedError`. This guard is pre-wired in this issue's Phase 3 so the AC
is satisfied, but the error is only exercisable after #196 ships.

### D6 (revised): Cursor declaration — mode=native, pluginsDir='', translationMode=flat

**Problem with original D6:** `translateFlat` emits paths shaped `${tool.directory}<section>/<pluginName>/<filename>`.
For Cursor (`directory = ".cursor/"`), this produces `.cursor/commands/aidd-context/foo.md`. Writing
relative to `~/.cursor/plugins/local/` yields `~/.cursor/plugins/local/.cursor/commands/aidd-context/foo.md`
— doubly-prefixed garbage. No amount of adapter wiring can fix this without changing PluginTranslator.

**Solution:** Use `mode: "native"` so `translateNativeWithPaths` is invoked instead of `translateFlat`.
With `pluginsDir: ""` (empty string), `translateNativeWithPaths` computes
`pluginRoot = "" + dist.manifest.name + "/"` = `"aidd-context/"`. File keys produced:
`aidd-context/commands/hello.md` — relative to the install base, exactly matching D2.

Concrete declaration changes for `cursor.ts`:
- `mode: "native"` (unchanged structurally; switches translator branch)
- `pluginsDir: ""` (empty string — no base-dir prefix prepended by translator)
- `pluginManifestRelativePath: null` (no manifest file written into the plugin dir)
- `translationMode: "native"` → adapter factory routes via `translationMode` field;
  **factory must also accept `translationMode: "native"` mapping to `ModeBFlatMaterializationAdapter`
  when `installScope === "user"`** — see Phase 3 for the routing decision
- `acceptsHooks: false`, `acceptsMcp: false`
- Remove `marketplaceSettings` (forward-compat field, now dead)
- Add `installScope: "user"`
- Add `userPluginsDir: (h) => join(h, ".cursor", "plugins", "local")`

Why no PluginTranslator changes: `translateNativeWithPaths` is generic — it uses `pluginsDir` as a
raw string prefix for the plugin root. Setting it to `""` repurposes the native path with a
plugin-name-only root, without touching domain logic. Domain stays pure.

All downstream tests asserting Cursor's current Mode A marketplace behavior must be updated (see Phase 5).

---

## Phases

### Phase 1: Extend PluginsCapability with installScope and user-path resolver

Goal: add the new fields to the capability without changing any behavior. OpenCode must compile and
all existing tests must pass unchanged.

Files touched:
- MODIFY `src/domain/capabilities/plugins-capability.ts`
  - Add `installScope?: "project" | "user"` (optional, default `"project"`) to `FlatPluginsParams`
  - Add `userPluginsDir?: (homedir: string) => string` to `FlatPluginsParams` — required when
    `installScope === "user"`; constructor throws `CapabilityConfigError` if user scope declared
    without resolver
  - Add `readonly installScope: "project" | "user"` to `PluginsCapability` class
  - Add `resolvePluginsBaseDir(projectRoot: string, homedir: string): string` method — returns
    `projectRoot` for project scope (flat-mode `pluginsDir` is null; `flatNamespacePrefix` is part
    of the relative file key, not a base dir), or `this.userPluginsDir!(homedir)` for user scope
  - Constructor assigns `installScope` and stores the `userPluginsDir` resolver function
  - All methods ≤ 20 lines; extract private static helper for validation if needed
  - Update JSDoc on `FlatPluginsParams` and new fields

Acceptance:
- `pnpm typecheck` passes
- `pnpm test` still passes (no behavior changed — OpenCode's installScope defaults to "project")
- `PluginsCapability` constructor throws when `installScope: "user"` without `userPluginsDir`

### Phase 2: Update Cursor tool declaration to Mode B (native mode, empty pluginsDir, user scope)

Goal: change Cursor from Mode A (native + marketplace) to Mode B using the revised D6 declaration.
`translateNativeWithPaths` is invoked via `mode: "native"`; `pluginsDir: ""` yields plugin-name-only
path roots (`aidd-context/`). Factory routes Cursor through `ModeBFlatMaterializationAdapter` based
on `installScope === "user"` (see Phase 3 for routing rule).

Files touched:
- MODIFY `src/domain/tools/ai/cursor.ts`
  - Keep `mode: "native"` (retains `translateNativeWithPaths` translator branch)
  - Set `pluginsDir: ""` (empty string — translator computes `pluginRoot = dist.manifest.name + "/"`)
  - Set `pluginManifestRelativePath: null` (no manifest file written into plugin dir)
  - Set `acceptsHooks: false`, `acceptsMcp: false`
  - Remove `marketplaceSettings` field and its associated `buildClaudeStyleMarketplaceEntry` import
  - Add `installScope: "user"` (new D1 field)
  - Add `userPluginsDir: (h) => join(h, ".cursor", "plugins", "local")` (new D1 field)
  - Do NOT add `flatNamespacePrefix` — that field is for `mode: "flat"` / `translateFlat` only
  - Update `HasPlugins` generic parameter if needed (double-check `HasMcp`/`HasHooks` are declared
    independently on cursor, not derived from plugins capability)
- MODIFY `src/domain/errors.ts` — add `CursorProjectScopeUnsupportedError` (message:
  "Cursor plugins only support user-scope install (~/.cursor/plugins/local/). Project-scope is
  not auto-loaded by Cursor.")

Acceptance:
- `pnpm typecheck` passes
- `cursor.capabilities.plugins.mode === "native"`
- `cursor.capabilities.plugins.pluginsDir === ""`
- `cursor.capabilities.plugins.installScope === "user"`
- `marketplaceSettings` field absent from Cursor plugins declaration
- Factory returns `ModeBFlatMaterializationAdapter` for cursor (routing verified in Phase 3)
- All tests that previously asserted Mode A marketplace behavior for Cursor are updated or deleted
  (marketplaceSettings tests in `cursor.unit.test.ts` become Mode B assertions)

### Phase 3: Mode B adapter — factory routing + resolvePluginsBaseDir

Goal: route Cursor through `ModeBFlatMaterializationAdapter` and make the adapter resolve the
correct write base dir for user-scope tools. `PluginTranslator` is NOT changed — it already
produces correct keys (`aidd-context/commands/foo.md`) via `translateNativeWithPaths` + `pluginsDir: ""`.

**Routing decision:** The adapter factory currently routes on `translationMode`. Cursor now declares
`mode: "native"` (not `"flat"`). The factory must be updated to also route to
`ModeBFlatMaterializationAdapter` when `installScope === "user"`, regardless of `translationMode`.
Concretely: the routing guard becomes — if `plugins.installScope === "user"` → use Mode B adapter.
The existing `translationMode === "flat"` guard (for OpenCode) remains. Both conditions produce the
same adapter; order: check `installScope === "user"` first, fall through to `translationMode` check.

**Translator branch:** `ModeBFlatMaterializationAdapter` calls
`PluginTranslator.translateWithComponentPaths(dist, toolConfig, docsDir)`. With Cursor's
`mode: "native"` and `pluginsDir: ""`, this dispatches to `translateNativeWithPaths`, which emits
`InstallationFile[]` with keys like `aidd-context/commands/foo.md`. No translator changes needed.

**Write-base resolution:** Current adapter passes `projectRoot` to `writePluginFiles`. For user-scope
this must be `~/.cursor/plugins/local/` instead. Fix: resolve base from capability and pass it.

Files touched:
- MODIFY `src/application/use-cases/plugin/translator/mode-b-flat-materialization-adapter.ts`
  - Inject `homedir: () => string` as a constructor parameter (constructor injection per DI rule)
  - Before calling `writePluginFiles`, resolve `baseDir`:
    `baseDir = plugins.resolvePluginsBaseDir(projectRoot, homedir())`
    Pass `baseDir` as the first argument to `writePluginFiles` instead of `projectRoot`.
  - `Plugin.fromDistribution` receives the original `InstallationFile[]` unchanged — keys remain
    relative to `baseDir`, matching what `StatusUseCase` will derive when checking drift.
  - Add pre-check: if `plugins.installScope === "user"` and a project-scope caller passes
    `scope: "project"` in future options, throw `CursorProjectScopeUnsupportedError`
  - All methods ≤ 20 lines; extract `resolveBaseDir(projectRoot)` private helper if needed
- MODIFY `src/application/use-cases/plugin/plugin-helpers.ts`
  - Rename parameter `projectRoot` → `baseDir` in `writePluginFiles(files, baseDir, fs)` for
    clarity; no logic change (still does `join(baseDir, f.relativePath)`)
- MODIFY `src/application/use-cases/plugin/translator/plugin-translation-adapter-factory.ts`
  - Update routing logic: also return `ModeBFlatMaterializationAdapter` when
    `plugins.installScope === "user"` (covers Cursor with `mode: "native"`)
  - Retain existing `translationMode === "flat"` route for project-scope flat tools (OpenCode)
  - Factory must receive `homedir` injection to pass to the adapter constructor
- MODIFY `src/infrastructure/deps.ts` — inject `homedir` (from `node:os`) into
  `ModeBFlatMaterializationAdapter` and/or the factory at wiring site

Acceptance:
- `aidd ai install cursor` writes plugin files at absolute path `~/.cursor/plugins/local/<name>/`
- File keys in `Plugin.files` remain relative (e.g. `aidd-context/commands/foo.md`) — no absolute paths
- OpenCode project-scope behavior unchanged (regression guard)
- `pnpm typecheck` passes
- `pnpm test` passes

### Phase 4: StatusUseCase drift detection for user-scope plugins

Goal: make drift detection work for user-scope plugins by resolving the correct base dir before
`checkOnePluginDrift`, and document the added-file scan limitation.

Files touched:
- MODIFY `src/application/use-cases/status-use-case.ts`
  - Import `homedir` from `node:os`
  - In `checkOnePluginDrift`'s call site (inside the per-plugin loop): resolve `baseDir`:
    - If `toolConfig.capabilities.plugins.installScope === "user"`:
      `baseDir = plugins.resolvePluginsBaseDir(projectRoot, homedir())`
    - Otherwise: `baseDir = projectRoot`
  - Change signature: `checkOnePluginDrift(files, baseDir)` — replaces `projectRoot` param
  - Add inline comment near `detectAddedFiles`: "User-scope plugin dirs (e.g. ~/.cursor/plugins/local/)
    are not scanned for added files; only tracked-file drift is detected."
  - Add inline comment in `checkOnePluginDrift`: "baseDir is projectRoot for project-scope,
    or homedir-resolved path for user-scope plugins (see D3 in 192-cursor-mode-b-plan)"

Acceptance:
- `StatusUseCase` passes all existing tests unchanged
- New user-scope drift tests (Phase 5) pass
- `aidd ai status cursor` reflects plugin drift when a user-scope plugin file is modified/deleted

### Phase 5: Tests

Goal: add assertions covering the new Cursor Mode B behavior and update stale Mode A assertions.

Files touched:
- MODIFY `tests/domain/tools/ai/cursor.unit.test.ts`
  - Remove all `capabilities.plugins.marketplaceSettings` describe block (Mode A, now stale)
  - Add describe `capabilities.plugins` — Mode B assertions:
    - `mode === "native"`
    - `pluginsDir === ""` (empty string)
    - `pluginManifestRelativePath === null`
    - `installScope === "user"`
    - `resolvePluginsBaseDir("/proj", "/home/user")` returns `/home/user/.cursor/plugins/local`
- MODIFY `tests/domain/capabilities/plugins-capability.unit.test.ts`
  - Add describe `when flat with user scope`:
    - `resolvePluginsBaseDir` returns homedir-based path
    - `installScope === "user"`
  - Add describe `when flat with project scope (default)`:
    - `resolvePluginsBaseDir` returns projectRoot-based path
  - Add describe `when flat with user scope but missing userPluginsDir resolver`:
    - constructor throws `CapabilityConfigError`
- NEW `tests/application/use-cases/plugin/translator/mode-b-flat-materialization-adapter.unit.test.ts`
  - describe `when tool has user installScope` (cursor-like):
    - writes plugin files to absolute user path resolved from homedir, not under projectRoot
    - Plugin.files keys are relative to user base dir (not absolute, not projectRoot-relative)
    - file written at `join(homedir(), ".cursor", "plugins", "local", "aidd-context", "cmd.md")`
  - describe `when tool has project installScope` (opencode-like):
    - writes plugin files under projectRoot (unchanged behavior — regression guard)
    - Plugin.files keys are relative to projectRoot
  - describe `when plugin distribution is empty`:
    - writes no files regardless of scope
- NEW `tests/application/use-cases/status-plugin-user-scope.unit.test.ts`
  - describe `when cursor plugin file has drifted` (base-relative key in manifest, user scope):
    - checkOnePluginDrift resolves absolute path from homedir + key before checking disk
    - returns plugin drift entry with the relative key
  - describe `when cursor plugin file is in sync`:
    - returns empty pluginDrift

- NEW `tests/application/use-cases/install-plugin-cursor-mode-b.integration.test.ts`
  - Uses real `MemoryFileWriter` (or `tmpdir` with `NodeFileSystem`), homedir injected as a
    controlled string (e.g. `/tmp/test-home`) via the constructor parameter added in Phase 3
  - describe `install cursor plugin via Mode B (integration)`:
    - after `ModeBFlatMaterializationAdapter.addPlugin(...)`:
      - file exists at `/tmp/test-home/.cursor/plugins/local/aidd-context/<file>`
      - no file written under `projectRoot`
      - `manifest.getPlugins("cursor")[0].files` keys are relative (e.g. `aidd-context/commands/foo.md`)
      - `join(resolvedBase, key)` matches the written path
  - Satisfies AC5: "Integration test asserts correct file structure at the user-level path"

Acceptance:
- `pnpm test` passes (all existing + new tests green)
- `pnpm knip:production` passes
- `pnpm lint` passes

---

## Rules table

| Rule | Source | Why it applies |
|---|---|---|
| Tool-specific knowledge in tool files | `.claude/rules/00-architecture/0-tool-config.md` | Path resolver for ~/.cursor/ must live in cursor.ts, not in the adapter |
| PluginsCapability is the declaration site | `2026_05_18-193-translation-mode-declaration-plan.md` | installScope declared on FlatPluginsParams, surfaced via capability |
| All fields readonly | `.claude/rules/02-programming-languages/2-typescript.md` | installScope must be readonly on PluginsCapability |
| Methods ≤ 20 lines | `.claude/rules/06-design-patterns/6-method-size.md` | resolvePluginsBaseDir and resolveBaseDir private helper must stay ≤ 20 lines |
| No any type | `.claude/rules/02-programming-languages/2-typescript.md` | All new signatures must be explicitly typed |
| Named exports only | `.claude/rules/01-standards/1-exports.md` | CursorProjectScopeUnsupportedError, CapabilityConfigError exported as named |
| Adapters throw typed domain errors | `.claude/rules/06-design-patterns/6-adapter.md` | CursorProjectScopeUnsupportedError thrown, not raw Error |
| Domain never imports app/infra | `.claude/rules/00-architecture/0-hexagonal.md` | resolvePluginsBaseDir stays pure (no homedir() call inside domain) — receives homedir as param |
| Relative imports with .js extension | `.claude/rules/02-programming-languages/2-typescript.md` | All new imports in modified files |
| Use describe blocks in tests | `memory/feedback_test_naming.md` | No "ClassName — behavior" prefix separators in test names |
| Constructor injection order | `.claude/rules/06-design-patterns/6-use-case.md` | homedir injected as FileSystem → ... order |
| No hardcoded technical strings in use-cases | `.claude/rules/06-design-patterns/6-use-case.md` | ~/.cursor/plugins/local/ declared in cursor.ts, not in adapter |

---

## Risks

1. **Cross-project manifest collision.** Two projects installing the same Cursor plugin both
   write to the same physical directory (`~/.cursor/plugins/local/<name>/`) and track the same
   relative keys in their separate manifests. Project B's `aidd plugin remove` deletes the user-level
   files; project A's manifest still lists them, so its next `aidd ai status` reports drift.
   Decision D4 accepts last-write-wins-delete semantics; add a `warn()` log when removing user-scope
   plugin files ("these files are user-scope and may be used by other projects"). Reference counting
   deferred as follow-up.

2. **homedir() resolution at manifest load time vs. write time.** `Plugin.files` keys are relative
   to the install base. When reading a manifest entry for drift detection, `StatusUseCase` must
   resolve the same base dir that was used during install. `resolvePluginsBaseDir(projectRoot, homedir())`
   is deterministic for a given machine/user, so this is safe. Risk: if the user moves their home
   dir or runs aidd as a different user after install, the resolved base changes and drift detection
   will report all files as deleted (correct behavior — the files are gone from that path). No
   mitigation needed; behavior matches user expectation.

3. **#196 scope flag interplay.** `--scope` for `aidd plugin install` does not exist yet (#196
   unmerged). The `CursorProjectScopeUnsupportedError` guard is pre-wired in Phase 3 but untriggerable
   until #196 ships. This is intentional — the guard is there so #196 can hook into it without a
   follow-up PR from this issue.

4. **PluginTranslator path computation for Cursor.** Cursor uses `mode: "native"` with `pluginsDir: ""`,
   so `translateWithComponentPaths` dispatches to `translateNativeWithPaths`. With `pluginsDir = ""`,
   `pluginRoot = "" + dist.manifest.name + "/" = "aidd-context/"`. Files emit as `aidd-context/commands/foo.md` —
   relative to the install base, correct for D2. Verify that `pluginManifestRelativePath: null`
   suppresses the manifest file write inside `translateNativeWithPaths` before Phase 3. (Current code
   at line 105-108: `if (sourceManifest !== null)` — but it checks `findSourceManifestContent`, not
   `pluginManifestRelativePath`. Confirm the null guard path is correct or add an explicit null check.)

5. **Existing Mode A Cursor tests break on Phase 2.** The `cursor.unit.test.ts` `marketplaceSettings`
   describe block (17 test cases) becomes stale the moment cursor.ts changes to flat mode. Phase 5
   must update these before the suite can pass. Plan the phase ordering accordingly: Phase 2 will
   temporarily break the cursor unit test suite until Phase 5 corrects it. Run `pnpm test` only after
   both Phase 2 and Phase 5 are applied in the same iteration.

6. **homedir() injection into Mode B adapter.** The adapter currently takes `(fs, hasher)`. Adding
   `homedir: () => string` as a third constructor parameter requires updating `deps.ts` wiring and
   all test instantiations of `ModeBFlatMaterializationAdapter`. Check `plugin-translation-adapter-factory.ts`
   — it constructs the adapter inline; it must also receive `homedir`.

---

## Test plan

### New unit tests (Phase 5)

`tests/domain/tools/ai/cursor.unit.test.ts` — modified:
- describe `capabilities.plugins` (Mode B assertions)
  - mode is "native"
  - pluginsDir is "" (empty string)
  - pluginManifestRelativePath is null
  - installScope is "user"
  - resolvePluginsBaseDir("/proj", "/home/user") returns "/home/user/.cursor/plugins/local"
  - marketplaceSettings absent

`tests/domain/capabilities/plugins-capability.unit.test.ts` — modified:
- describe `when flat with user scope`
  - resolvePluginsBaseDir returns correct absolute path
  - installScope is user
- describe `when flat with user scope and missing resolver`
  - constructor throws

`tests/application/use-cases/plugin/translator/mode-b-flat-materialization-adapter.unit.test.ts` — new:
- describe `when tool is user-scoped (cursor-like)`
  - writes files to resolved absolute path under homedir (not under projectRoot)
  - manifest Plugin.files keys are relative to user base dir (not absolute)
- describe `when tool is project-scoped (opencode-like)`
  - writes files under projectRoot (regression guard)
- describe `when plugin distribution is empty`
  - no files written

`tests/application/use-cases/status-plugin-user-scope.unit.test.ts` — new:
- describe `when cursor plugin file drifted (base-relative key)`
  - baseDir resolved from homedir; join(baseDir, key) checked on disk
  - pluginDrift entry returned with the relative key
- describe `when cursor plugin file in sync (base-relative key)`
  - pluginDrift empty

`tests/application/use-cases/install-plugin-cursor-mode-b.integration.test.ts` — new (satisfies AC5):
- describe `install cursor plugin via Mode B (integration)`
  - file materialized at controlled homedir path (injected tmpdir)
  - no file written under projectRoot
  - manifest keys are base-relative

### Regression gate

- `pnpm test` after Phase 1 — baseline count unchanged
- `pnpm test` after Phase 2 + Phase 5 combined — cursor Mode A tests replaced, no net drop
- `pnpm typecheck` after each phase
- `pnpm knip:production` after Phase 5
- `pnpm lint` after Phase 5

---

## Output

```yaml
plan_path: aidd_docs/tasks/2026_05/2026_05_18-192-cursor-mode-b-plan.md
child_paths: []
decisions_made:
  - D1: capability-level installScope + userPluginsDir resolver on FlatPluginsParams
  - D2: Plugin.files keys stay relative to install base dir; resolve base at I/O time via resolvePluginsBaseDir(projectRoot, homedir())
  - D3: StatusUseCase.checkOnePluginDrift receives resolved baseDir; homedir() called at call site
  - D4: cross-project last-write-wins-delete with warn() log; reference counting deferred
  - D5: Cursor project-scope rejected with CursorProjectScopeUnsupportedError; guard pre-wired, untriggerable until #196
  - "D6 revised per Option 1: mode=native, pluginsDir='', translationMode unchanged, installScope=user — translateNativeWithPaths produces aidd-context/<files> keys via empty pluginsDir; no PluginTranslator changes"
  - "Phase 2 revised: cursor.ts keeps mode=native, sets pluginsDir='', pluginManifestRelativePath=null, removes marketplaceSettings, adds installScope+userPluginsDir"
  - "Phase 3 revised: factory routing updated to also map installScope=user → ModeBFlatMaterializationAdapter; plugin-translation-adapter-factory.ts and deps.ts both touched for homedir injection"
decisions_blocked: []
plan_status: ready
```
