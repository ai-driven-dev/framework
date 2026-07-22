---
name: framework-build-codex
status: planned
date: 2026-05-26
scope: MVP1 (Mode A + agents hybrid)
target: codex
spec: ./2026_05_26-framework-build-codex-spec.md
branch: feat/framework-build-codex
phases: 4
---

# Plan — `aidd framework build --target codex`

## 0. Reuse inventory (mandatory)

| # | Capability needed | Existing helper / class | Reuse decision | Rationale |
|---|---|---|---|---|
| 1 | Strategy abstraction | `BuildOutputStrategy` (`strategies/build-output-strategy.ts`) | Direct (implement interface) | Spec §"Reuse contract" — codex is a third implementation. Interface already exposes every per-plugin hook needed. |
| 2 | Orchestrator scaffold (path guard, source-marketplace parse, halt-at-first-failure, warn-out-of-scope, totals) | `FrameworkBuildUseCase` (`framework-build-use-case.ts`) | Direct — inject strategy, no orchestrator change | `execute()` already iterates `sourceMarketplace.plugins` and calls `strategy.write*` then `strategy.postBuild`. Codex slots in via constructor strategy arg. |
| 3 | `${CLAUDE_PLUGIN_ROOT}` and `@./X`, `@../X` rewriting in `.md` | `rewriteRelativeLinks` (`formats/relative-link-rewrite.ts`) | Direct | Already produces markdown-link form. Spec AC #6 accepts this output verbatim. Default `resolveTargetPath` (identity) matches Mode A semantics, which is what codex skills want. |
| 4 | `@{{TOOLS}}/` guard | `assertNoToolsPlaceholder` (`shared-plugin-helpers.ts`) | Direct | Spec §"Per-plugin pipeline" rule 6 reuses the existing `FrameworkPlaceholderInPluginError`. |
| 5 | Frontmatter parse / serialize | `parseFrontmatter`, `serializeFrontmatter` (`formats/markdown.ts`) | Direct (parse only; serialize unused — TOML output replaces it) | Codex agents emit TOML, not markdown; `parseFrontmatter` only is needed. |
| 6 | TOML stringify (deterministic key order) | `stringifyToml` (`formats/toml.ts`) | Direct | Wraps `smol-toml`. Determinism is achieved by feeding an object whose own iteration order is fixed (insertion order). Build helper inserts keys in canonical order. |
| 7 | Path-pair safety guard | `InvalidBuildPathsError` + `FrameworkBuildUseCase.guardPaths` | Direct (orchestrator already runs it) | Spec §"Safety guard" identical to Mode A. No new error class. |
| 8 | Source plugin manifest schema validation | `JsonSchemaValidator` + `assetProvider.loadPluginManifestSchema()` | Direct (orchestrator already runs it) | Spec AC #10. Source plugins ship the Claude shape; the existing schema validates them as today. |
| 9 | Out-of-scope warn (`commands/`, `rules/`) | `OUT_OF_SCOPE_PLUGIN_SECTIONS` + `warnOutOfScopeSections` | Direct (orchestrator already runs it) | Spec AC #9 explicitly mirrors Mode A behavior. |
| 10 | Source-marketplace parse | `FrameworkBuildUseCase.readSourceMarketplace` + `validateSourceMarketplace` | Direct (orchestrator already runs it) | No codex-specific change to source parsing. |
| 11 | Plugin presence detection (`hasHooksJson`, `hasMcpJson`, skill names list, agent presence) | `MarketplaceOutputStrategy.detectPluginPresenceFlags` + `listSkillNames` + `hasAgentFiles` (private) | Extract to shared module in Phase 2, then reuse | Identical logic needed for codex manifest synthesis. Duplicating violates the reuse mandate; extraction is a no-behavior-change refactor for copilot Mode A. |
| 12 | Skill file copy + `.md` rewrite | `MarketplaceOutputStrategy.writeSkillFile` (private) | Extract to shared module in Phase 2, then reuse | Codex skill emission is identical to Mode A (same path layout `<out>/plugins/<plugin>/skills/<name>/...`, same `.md` rewrite). |
| 13 | Plugin-manifest-synthesis common bookkeeping (name/description/version/author/homepage/repository/license/keywords passthrough) | `MarketplaceOutputStrategy.synthesizePluginManifest` (private) | Reference only — codex needs different output keys (no `agents`, codex-canonical paths) and writes to a different file (`.codex-plugin/plugin.json`). Build a new `synthesizeCodexPluginManifest` that consumes the same `PluginPresenceFlags`. | Mode A writes to `OUTPUT_PLUGIN_MANIFEST_RELATIVE` (which currently equals `${COPILOT_WORKSPACE_DIR}plugin/plugin.json`) and emits an `agents` field. Codex writes to `.codex-plugin/plugin.json` and omits `agents`. Public fields' passthrough logic is small and can stay duplicated (≤10 LOC); attempting to share it pulls Copilot-specific paths into the shared module. |
| 14 | Hooks JSON copy | `MarketplaceOutputStrategy.rewriteJsonFile` (private) | **DO NOT REUSE** — write raw bytes via `fs.readFile`+`fs.writeFile`. | Spec AC #7 mandates byte-for-byte copy. `rewriteJsonFile` calls `rewriteClaudeRootInJson` which replaces `${CLAUDE_PLUGIN_ROOT}/` with `./`. Codex expands `${CLAUDE_PLUGIN_ROOT}` natively — rewriting would break that. |
| 15 | MCP JSON copy | Same as #14 | **DO NOT REUSE** — write raw bytes. | Spec AC #8 mandates byte-for-byte copy; same reasoning. |
| 16 | Hook sibling files (scripts, etc.) | Loop in `MarketplaceOutputStrategy.writeHooks` | Pattern reuse — direct byte copy logic is trivial, fine to replicate (4 lines). | Mode A already does direct byte copy for non-`.json` siblings. |
| 17 | Agent FM strip helper (`stripAgentFrontmatter`) | `formats/agent-frontmatter-strip.ts` | **NOT REUSED** | Spec §"Reuse contract" is explicit: codex maps Claude FM → Codex TOML schema (`name`/`description`/`developer_instructions`/`model?`), not the Copilot FM allowlist. New helper required. |
| 18 | Marketplace emission shape | `MarketplaceOutputStrategy.emitMarketplaceCopilot` (private) | Reference only — codex emits a different schema (Claude shape) to a different path (`<out>/.claude-plugin/marketplace.json`). | Required keys, plugin entry shape, and `metadata.pluginRoot` rule all differ. Build a new `emitCodexMarketplace`. The version-resolution / description-resolution sub-helpers (`resolveVersion`, `resolveDescription`) are reusable — extract in Phase 2. |
| 19 | Version / description resolver helpers | `MarketplaceOutputStrategy.resolveVersion`, `resolveDescription` (private) | Extract to shared module in Phase 2, then reuse | Identical resolution logic needed: source-entry first, else manifest, else throw `InvalidSourceMarketplaceError`. |
| 20 | Bundled marketplace schema | `assets/schemas/copilot-plugin-marketplace.json` | **NOT REUSED** — see Decision D-1. | Copilot schema requires `metadata.pluginRoot`; Claude shape has no `metadata` object. New bundled schema required. |
| 21 | Asset loader / JSON-schema validator | `BundledAssetProviderAdapter`, `AjvSchemaValidatorAdapter` | Extended (add Claude marketplace + Codex plugin schema loaders) | Add `loadClaudeMarketplaceSchema()` and `loadCodexPluginManifestSchema()` to the `AssetProvider` port. |
| 22 | CLI flag plumbing | `application/commands/framework.ts` | Extended (relax `--target codex` block; keep `--flat`/`--force` copilot-only guard) | Spec §"Command" requires `--target codex` (no `--flat`, no `--force`). |
| 23 | Deps factory | `infrastructure/deps.ts` (`createDeps`, `createFlatFrameworkBuildUseCase`) | Extended (new `createCodexFrameworkBuildUseCase` factory) | Mirrors the flat factory pattern (constructs strategy, wires `FrameworkBuildUseCase`). |

---

## 1. Decisions

Status legend: **M** = must / locked; **C** = chosen with rationale; **D** = deferred / out-of-scope.

### D-1 (M) — Codex marketplace bundled schema is NEW

**Decision**: Add `assets/schemas/claude-marketplace-manifest.json`. Do **not** reuse `copilot-plugin-marketplace.json`.

**Rationale**: The Copilot schema requires `["name","metadata","owner","plugins"]` with `metadata.pluginRoot` mandatory, and plugin entries shaped as Copilot-flat. The source marketplace (and the Codex output per spec) uses the Claude shape: flat `name`/`version`/`description`/`owner`/`plugins`, with plugin entries `{name, source: "./plugins/<n>", description, version, strict?, recommended?}` and no `metadata` object. Required-key sets are incompatible — using the Copilot schema would reject every valid Codex output.

**Action**: Bundle a new schema (hand-crafted, draft-07, `$comment` cites `https://json.schemastore.org/claude-code-marketplace.json` and the date). Required: `["name","plugins"]`. Plugin items required: `["name","source","description","version"]`. Allow `additionalProperties: true`. Source: mirror the published `claude-code-marketplace.json` shape and the fixture at `tests/fixtures/framework-real/.claude-plugin/marketplace.json`.

### D-2 (M) — Codex plugin manifest bundled schema is NEW

**Decision**: Add `assets/schemas/codex-plugin-manifest.json` (hand-crafted from `https://developers.openai.com/codex/plugins/build` docs).

**Rationale**: Spec AC #3. No published Codex plugin manifest JSON schema exists; the build must validate its synthesized output to catch regressions.

**Shape**: required `["name"]`. Allowed: `name`, `version`, `description`, `author` (string or `{name,email?,url?}`), `homepage`, `repository`, `license`, `keywords` (string[]), `skills` (string[]), `hooks` (string), `mcpServers` (string), `apps` (string), `interface` (object). `additionalProperties: false` to catch typos. `$comment` cites the docs URL and date.

### D-3 (C) — `${CLAUDE_PLUGIN_ROOT}` in skill body → REWRITE to markdown link

**Decision**: Rewrite `@${CLAUDE_PLUGIN_ROOT}/X` to `[X](<file-relative path>)` inside skill `.md` files, same as Mode A. Do not preserve.

**Rationale**:
1. Reuse mandate — `rewriteRelativeLinks` already does this; preserving requires forking the helper.
2. Spec's stated default is rewrite ("Spec defaults to **rewrite** for consistency").
3. Skills are user-facing prompt content; markdown links are more universally readable across surfaces (web preview, GitHub render, etc.).
4. The skill body never contains shell-level path semantics — it's prose with file references. Codex's `${CLAUDE_PLUGIN_ROOT}` expansion was designed for hooks/MCP shell commands and config paths, not for markdown narrative.

Exception scope: this decision applies only to skill `.md` bodies. Hooks `hooks.json` and `.mcp.json` remain byte-for-byte copy (where `${CLAUDE_PLUGIN_ROOT}` IS preserved because Codex expands it natively).

### D-4 (M) — Agent body `@./`, `@../`, `@${CLAUDE_PLUGIN_ROOT}/` → PRESERVE verbatim in TOML

**Decision**: The body that lands in `developer_instructions` is NOT passed through `rewriteRelativeLinks`. It is the parsed markdown body verbatim (frontmatter stripped).

**Rationale**: Spec §"Per-plugin pipeline" rule 4 is explicit: "The body's `@./X` / `@../X` / `@${CLAUDE_PLUGIN_ROOT}/X` references are **left untouched** — Codex's expansion rules for these inside developer_instructions are undocumented; preserve verbatim." This avoids guessing at codex semantics for agent bodies; install-time consumer surface can post-process.

Test gate: an agent fixture body containing `@./foo.md`, `@../bar.md`, and `@${CLAUDE_PLUGIN_ROOT}/baz.md` must serialize into the TOML `developer_instructions` field unchanged.

### D-5 (M) — `model` mapping → OMIT in MVP1

**Decision**: The codex agent TOML `model` key is always omitted in MVP1. No mapping table is shipped.

**Rationale**: Spec says emit `model` "when value is a known Codex model id; otherwise omitted". The known-id set is empty as of 2026-05-26 — Codex docs do not publish the canonical model id list, and the framework's own agent fixtures only use `model: opus` and `model: sonnet` (Claude ids, not Codex). With an empty known-set, the rule collapses to always-omit. Mapping is deferred to a separate ticket once Codex publishes an enumerable model id list.

Test gate: parsing `model: opus` produces a TOML with no `model` key. Parsing `model: gpt-5-codex` (hypothetical future Codex id) also produces no `model` key in MVP1.

### D-6 (M) — In-plugin staging path → `codex-agents/`

**Decision**: Emit TOML files at `<out>/plugins/<plugin>/codex-agents/<n>.toml` (matches spec verbatim).

**Rationale**:
1. Doesn't collide with `agents/` (which Codex plugin schema does not declare — Codex would treat any `agents/` directory in a plugin tree as ignored).
2. Name signals "staged for codex consumer surface". The install-time `aidd plugin install --tool codex` reads this directory and materializes to `.codex/agents/<plugin>-<name>.toml` at the consuming project root.
3. Distinct enough that a future Codex spec change (e.g. plugin-side `agents` field) won't collide.

### D-7 (M) — Hooks & MCP files → BYTE-FOR-BYTE copy

**Decision**: For codex target, hooks `hooks.json` (and sibling scripts) and `.mcp.json` are copied via raw `fs.readFile` → `fs.writeFile`. **No JSON parse, no key rewrite, no `rewriteClaudeRootInJson` call.**

**Rationale**: Spec AC #7 and #8 are explicit. Codex expands `${CLAUDE_PLUGIN_ROOT}` natively for legacy compat per docs ("Codex sets `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA` for compatibility with existing plugin hooks"). If we re-parse + re-serialize JSON we would (a) potentially reorder keys and break determinism in subtle ways, (b) potentially mutate string values via the path-rewrite helper if a contributor extends `rewriteJsonFile`. Byte-for-byte is the contractually safest path.

**Risk flagged in Do-not-duplicate list below**: lazy reuse of `MarketplaceOutputStrategy.rewriteJsonFile` is the most likely landmine.

### D-8 (M) — `agents` field omitted from synthesized codex plugin manifest

**Decision**: Synthesized `.codex-plugin/plugin.json` never declares `agents`, even when the source plugin ships agents.

**Rationale**: Codex plugin schema does not support `agents` (subagents are workspace-only). Agents are handled via the parallel `codex-agents/` staging path. Spec §"Per-plugin pipeline" rule 2 and AC #9 are both explicit.

### D-9 (M) — Marketplace path → `<out>/.claude-plugin/marketplace.json`

**Decision**: Emit the Claude-shaped marketplace catalog at `<out>/.claude-plugin/marketplace.json`. Do not emit at the Copilot path (`${COPILOT_WORKSPACE_DIR}plugin/marketplace.json`).

**Rationale**: Spec §"Marketplace output" — Codex auto-discovers `.claude-plugin/marketplace.json` at the repo root for legacy compat (per docs). The existing `OUTPUT_MARKETPLACE_RELATIVE` constant is bound to the Copilot location; the codex strategy needs its own constant.

**Action**: Add `OUTPUT_CODEX_MARKETPLACE_RELATIVE = ".claude-plugin/marketplace.json"` to `framework-build.ts` (or to a new `codex-paths.ts`). Add `OUTPUT_CODEX_PLUGIN_MANIFEST_RELATIVE = ".codex-plugin/plugin.json"`.

### D-10 (C) — Shared private helpers → extract to module, not inheritance

**Decision**: Extract reusable private methods from `MarketplaceOutputStrategy` into a new pure module `strategies/marketplace-strategy-helpers.ts` (named function exports). Do **not** introduce an abstract base class.

**Rationale**:
- "Named exports only — no `export default`" and "No barrel files" rules already discourage class hierarchies for cross-cutting reuse.
- Extracted candidates are stateless (no `this.fs` capture needed if the `fs` is passed): `detectPluginPresenceFlags`, `listSkillNames`, `hasAgentFiles`, `resolveVersion`, `resolveDescription`, `writeSkillFile`. They become free functions taking `(fs, ...args)`.
- An abstract base class would force `protected` access patterns and tangle constructor-injection rules with inheritance.
- Phase 2 is a pure refactor: no behavior change for `MarketplaceOutputStrategy`; existing integration tests must still pass.

**Scope of extraction**:
- `hasAgentFiles(fs, agentsDir)` → free
- `listSkillNames(fs, pluginSrc)` → free
- `detectPluginPresenceFlags(fs, pluginSrc)` → free
- `writeSkillFileShared(fs, pluginName, absPath, skillsSrc, pluginOut)` → free (Mode A path layout; codex reuses it because codex skill output layout is identical to Mode A)
- `resolveVersion(fs, name, srcEntry, outDir, outputManifestRelative)` → free, parameterize the manifest path
- `resolveDescription(fs, name, srcEntry, outDir, outputManifestRelative)` → free, parameterize the manifest path

### D-11 (M) — Error class reuse

**Decision**: No new error classes. Reuse `InvalidBuildPathsError`, `JsonSchemaValidationError`, `FrameworkPlaceholderInPluginError`, `InvalidSourceMarketplaceError`.

**Rationale**: Spec §"Safety guard" and AC #10 require these specific class names verbatim; they all exist in `domain/errors.ts`. Codex-specific failure modes (invalid Codex manifest, malformed agent FM) surface via `JsonSchemaValidationError` (after ajv validation) and naturally-thrown parse errors.

### D-12 (D) — `--flat` for codex → deferred

**Decision**: Out of scope for this SDLC. The command guard `if (cmdOptions.flat && cmdOptions.target !== "copilot") output.error(...)` stays.

**Rationale**: Spec §"Out of scope" is explicit. The codex workspace path materialization (`.codex/agents/`) is the install-time surface, not the build surface.

### D-13 (D) — `--force` for codex → deferred

**Decision**: Out of scope. The orchestrator always wipes-and-recreates `<out>` for codex (matches Mode A copilot behavior).

**Rationale**: Spec §"Command" says "No `--flat` and no `--force` in this SDLC." The `MarketplaceOutputStrategy.preBuild` wipe-and-recreate behavior is exactly what codex needs.

### D-14 (M) — Agent file frontmatter parsing

**Decision**: Reuse `parseFrontmatter` from `formats/markdown.ts`. The body is everything after the frontmatter delimiter, returned as a single string. No further mutation before placement into TOML.

**Rationale**: D-4 mandates verbatim body. `parseFrontmatter` already returns `{ frontmatter, body }` with the body unmutated.

### D-15 (M) — Agent TOML key order

**Decision**: Fixed insertion order in the new helper: `name`, `description`, `model?`, `developer_instructions`. (`model` only when D-5 permits — currently never.)

**Rationale**: Determinism (AC #2 — byte-identical output across runs). `stringifyToml` from `smol-toml` preserves insertion order. Test gate: a snapshot test asserts byte equality across two consecutive runs.

### D-16 (M) — Agent name resolution

**Decision**: TOML `name` = `frontmatter.name` when present (string), else `<plugin>-<basename-without-.md>`. The plugin-prefix fallback prevents cross-plugin name collisions in the final `.codex/agents/` directory.

**Rationale**: Spec §"Per-plugin pipeline" rule 4 lists this. Plugin-prefix fallback matches consumer-side expectation (Codex agents are flat in `.codex/agents/` — collisions would shadow earlier files).

### D-17 (M) — Codex plugin manifest passthrough fields

**Decision**: Pass through `name`, `description`, `version`, `author`, `homepage`, `repository`, `license`, `keywords` from the source plugin manifest. Drop everything else (notably Claude-only `strict`, `$schema`, `dependencies`).

**Rationale**: Spec §"Per-plugin pipeline" rule 2. Mirrors `synthesizePluginManifest` in `MarketplaceOutputStrategy` minus the Copilot-side `agents` field.

### D-18 (M) — Halt-at-first-failure preserved

**Decision**: No catch blocks anywhere in `CodexOutputStrategy`. First raw throw bubbles to `FrameworkBuildUseCase.execute()`, then to the command's `errorHandler.handle()`.

**Rationale**: `0-error-handling.md` rule + spec §"Behavior" ("Halt-at-first-failure per plugin").

---

## 2. Phases

Each phase = one conventional commit boundary unless explicitly multi-commit.

### Phase 1 — Domain helpers, schemas, asset loader extension

**Objective**: Land all pure-domain pieces and asset wiring without touching strategies or orchestrator. Unblocks Phases 2–4.

**Files added**:
- `assets/schemas/claude-marketplace-manifest.json` (D-1).
- `assets/schemas/codex-plugin-manifest.json` (D-2).
- `src/domain/formats/codex-agent-toml.ts` — `codexAgentMarkdownToToml(content: string, pluginName: string, fileBaseName: string): string` (uses `parseFrontmatter` + `stringifyToml`). Methods ≤20 LOC.
- `src/domain/formats/codex-paths.ts` — exported constants:
  - `OUTPUT_CODEX_MANIFEST_RELATIVE = ".codex-plugin/plugin.json"`
  - `OUTPUT_CODEX_MARKETPLACE_RELATIVE = ".claude-plugin/marketplace.json"` (intentionally distinct constant from `SOURCE_MARKETPLACE_RELATIVE` despite identical literal value — codex output happens to mirror the source path because of the Claude-marketplace legacy-compat reason cited in D-9; future changes to either side must not collapse them)
  - `OUTPUT_CODEX_AGENTS_DIR = "codex-agents"`

**Files modified**:
- `src/domain/ports/asset-provider.ts` — add `loadClaudeMarketplaceSchema(): object` and `loadCodexPluginManifestSchema(): object` methods.
- `src/infrastructure/assets/asset-loader.ts` — add cached loaders for both new schema files; extend `readSchemaFileFromDisk`-style lookup.
- `src/domain/models/framework-build.ts` — no change here; constants are in `codex-paths.ts` for locality.

**Test gates (`*.unit.test.ts`)**:
1. `codex-agent-toml.unit.test.ts`:
   - Empty frontmatter → TOML has `developer_instructions` only.
   - FM `name: "planner"` + body `"X"` → keys ordered `name`, `description?`, `developer_instructions`.
   - FM `name: "planner", description: "...", model: "opus"` → `model` key is omitted (D-5).
   - FM missing `name` + file `planner.md` in plugin `aidd-dev` → TOML `name = "aidd-dev-planner"` (D-16).
   - Body containing `@./foo.md`, `@../bar.md`, `@${CLAUDE_PLUGIN_ROOT}/baz.md` → all three preserved verbatim in `developer_instructions` (D-4).
   - Two consecutive emits with identical input produce byte-identical strings (D-15, AC #2).
   - Multi-line body with code fences, headings, and triple-quoted-friendly characters → round-trips via `parseToml(stringifyToml(...))`.
2. `claude-marketplace-manifest.unit.test.ts`:
   - Validates `tests/fixtures/framework-real/.claude-plugin/marketplace.json` successfully.
   - Rejects missing `plugins` array.
   - Rejects plugin entry missing `name`.
3. `codex-plugin-manifest.unit.test.ts`:
   - Validates a minimal `{name: "x"}` manifest.
   - Validates the full passthrough shape (`name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `skills: ["./skills/x"]`, `hooks: "./hooks/hooks.json"`, `mcpServers: "./.mcp.json"`).
   - Rejects unknown key (e.g. `agents` or `commands`) — `additionalProperties: false`.

**Exit criterion**: All Phase 1 unit tests pass. `biome check --write` clean on touched files. No imports from `application/` or `infrastructure/` into `domain/formats/codex-agent-toml.ts` or `codex-paths.ts`. Maps to spec AC #2, #3, #5 (partial).

**Commit**: `feat(framework-build): codex domain helpers + bundled schemas`.

---

### Phase 2 — Extract reusable strategy helpers (pure refactor)

**Objective**: Move private methods from `MarketplaceOutputStrategy` into a free-function module so the codex strategy can reuse them without inheritance. **No behavior change.** All existing Mode A and flat tests must remain green.

**Files added**:
- `src/application/use-cases/framework/strategies/marketplace-strategy-helpers.ts` — exports:
  - `detectPluginPresenceFlags(fs, pluginSrc): Promise<PluginPresenceFlags>`
  - `hasAgentFiles(fs, agentsDir): Promise<boolean>`
  - `listSkillNames(fs, pluginSrc): Promise<readonly string[]>`
  - `writeSkillTree(fs, pluginName, pluginSrc, pluginOut): Promise<number>` — encapsulates the Mode-A skill copy + `.md` rewrite loop
  - `resolveVersion(fs, name, srcEntry, outDir, outputManifestRelative): Promise<string>`
  - `resolveDescription(fs, name, srcEntry, outDir, outputManifestRelative): Promise<string>`
  - Re-export the `PluginPresenceFlags` interface.

**Files modified**:
- `src/application/use-cases/framework/strategies/marketplace-output-strategy.ts` — replace inlined private methods with calls into the new module. Keep `synthesizePluginManifest` (Copilot-specific manifest shape stays local). Class methods remain ≤20 LOC each.

**Test gates**:
1. Existing `marketplace-output-strategy.*.test.ts` (if present) and `framework-build-use-case.integration.test.ts` pass unchanged.
2. Existing e2e test (`tests/e2e/framework-build.e2e.test.ts`) passes unchanged.
3. New `marketplace-strategy-helpers.unit.test.ts` covering each extracted function with the same fixtures.

**Exit criterion**: Touched code lints clean; existing test suite green at the same green count it had before this phase. No new behavior. Maps to no new spec AC (reuse-mandate enabler).

**Commit**: `refactor(framework-build): extract reusable strategy helpers`.

---

### Phase 3 — `CodexOutputStrategy` + integration tests

**Objective**: Implement the third strategy. Wire deterministic codex tree emission. Cover spec AC #1, #2, #5, #6, #7, #8, #9, #10 with integration tests against the in-repo `tests/fixtures/framework-real` fixture.

**Files added**:
- `src/application/use-cases/framework/strategies/codex-output-strategy.ts` — implements `BuildOutputStrategy`:
  - `preBuild(outDir)` → wipe + recreate (same as Mode A; one-liner reusing `fs.deleteDirectory` + `fs.createDirectory`).
  - `writePluginManifest(...)` → read source manifest, call `detectPluginPresenceFlags`, call `synthesizeCodexPluginManifest` (private, in this file), ajv-validate against `loadCodexPluginManifestSchema()`, write JSON to `<out>/plugins/<plugin>/.codex-plugin/plugin.json`. Returns 1.
  - `writeAgents(...)` → iterate `agents/*.md`, for each: read file, call `assertNoToolsPlaceholder`, call `codexAgentMarkdownToToml`, write to `<out>/plugins/<plugin>/codex-agents/<basename>.toml`. Returns count.
  - `writeSkills(...)` → delegate to `writeSkillTree` helper from Phase 2 (identical Mode-A layout).
  - `writeHooks(...)` → byte-for-byte copy of every file under `hooks/` (D-7). Returns count.
  - `writeMcp(...)` → byte-for-byte copy of `.mcp.json` to `<out>/plugins/<plugin>/.mcp.json` (D-7). Returns 1.
  - `postBuild(sourceMarketplace, builtPlugins, outDir)` → build Claude-shape marketplace object, ajv-validate against `loadClaudeMarketplaceSchema()`, write to `<out>/.claude-plugin/marketplace.json`. Returns 1.
  - Private `synthesizeCodexPluginManifest(source, presence)` ≤ 20 LOC — passthrough D-17 fields, set `skills` / `hooks` / `mcpServers` per presence, never set `agents`.
  - Private `buildCodexMarketplaceObject(sourceMarketplace, pluginEntries)` ≤ 20 LOC — emits Claude shape: `{name, version?, description?, owner, plugins: [{name, source: "./plugins/<n>", description, version, strict?, recommended?}]}`. Plugin entries preserve `strict` and `recommended` from source-marketplace entry when present.

**Files modified**: none in this phase.

**Test gates (`*.integration.test.ts`)**:
1. `codex-output-strategy.integration.test.ts` (using `InMemoryFileAdapter` + `framework-real` fixture seeded via `seedFromDirectory`):
   - **Tree shape (AC #1)**: assert presence of `<out>/.claude-plugin/marketplace.json`, `<out>/plugins/aidd-dev/.codex-plugin/plugin.json`, `<out>/plugins/aidd-dev/skills/<each-skill>/SKILL.md`, `<out>/plugins/aidd-dev/hooks/hooks.json` (when source has hooks), `<out>/plugins/aidd-dev/.mcp.json` (when source has mcp), `<out>/plugins/aidd-dev/codex-agents/planner.toml`, `implementer.toml`, `reviewer.toml`.
   - **Idempotency (AC #2)**: run twice into same `<out>`, assert byte-identical content for every emitted file.
   - **Codex manifest schema valid (AC #3)**: parse `.codex-plugin/plugin.json` and re-validate via `loadCodexPluginManifestSchema`.
   - **Marketplace schema valid (AC #4)**: parse `.claude-plugin/marketplace.json` and re-validate via `loadClaudeMarketplaceSchema`.
   - **TOML valid (AC #5)**: `parseToml(content)` succeeds for every `codex-agents/*.toml`; each parsed object has `name`, `description`, `developer_instructions`.
   - **Skill rewrite (AC #6)**: add a synthetic fixture skill (Phase 3 deliverable) at `tests/fixtures/framework-codex/plugins/aidd-codex-fixture/skills/sample/SKILL.md` whose body contains all three reference forms (`@./neighbor.md`, `@../up.md`, `@${CLAUDE_PLUGIN_ROOT}/agents/planner.md`) AND a `@{{TOOLS}}/` line that the negative test toggles off. The integration test runs against this fixture and asserts output contains `[neighbor.md](./neighbor.md)`, `[up.md](../up.md)`, and a markdown-link form for the CLAUDE_PLUGIN_ROOT case computed file-relative. The implementer does NOT decide whether to amend a real plugin's content — the fixture is dedicated to this AC.
   - **Hooks byte-for-byte (AC #7)**: SHA-256 hash of source `hooks/hooks.json` equals hash of output `hooks/hooks.json`. Same for sibling files.
   - **MCP byte-for-byte (AC #8)**: SHA-256 hash equality for `.mcp.json`.
   - **`agents` field absent (AC #9)**: synthesized `.codex-plugin/plugin.json` has no `agents` key, even when source has agents.
   - **Out-of-scope warn (AC #9)**: when source has `commands/` or `rules/`, the orchestrator warns and these directories don't appear in `<out>/plugins/<plugin>/`.
   - **Invalid source manifest (AC #10)**: feed a manifest that fails ajv → orchestrator throws `JsonSchemaValidationError`.
   - **Invalid build paths (AC #10)**: `source === out` throws `InvalidBuildPathsError`.
   - **`@{{TOOLS}}/` in plugin content**: throws `FrameworkPlaceholderInPluginError`.
   - **Agent body verbatim (D-4)**: a fixture agent body containing all three reference forms ends up unchanged inside `developer_instructions`.
   - **Model omitted (D-5)**: fixture agent with `model: opus` produces TOML with no `model` key.

**Exit criterion**: All Phase 3 integration tests pass. Method-size ≤ 20 LOC enforced (`biome check`). Maps to spec AC #1, #2, #3, #4, #5, #6, #7, #8, #9, #10.

**Commit**: `feat(framework-build): codex output strategy`.

---

### Phase 4 — CLI wiring + E2E test + docs

**Objective**: Make `aidd framework build --target codex --source <path> --out <dist>` runnable end-to-end. Cover spec AC #11 (smoke command runs) and AC #12 (e2e tree shape).

**Files modified**:
- `src/application/commands/framework.ts`:
  - Relax the target guard from `if (cmdOptions.target !== "copilot")` to allow `copilot` or `codex`.
  - Keep the `--flat` + `--force` requires-copilot guards intact (D-12, D-13).
  - Update the description string of the command to mention codex.
  - Update the success message to be target-aware (matches spec wording for codex: `Built <N> plugins, <M> files written to <out>`).
- `src/infrastructure/deps.ts`:
  - Add `createCodexFrameworkBuildUseCase(deps): FrameworkBuildUseCase` factory (mirror of `createFlatFrameworkBuildUseCase` without the `force`/`absOut` args).
  - Constructs `CodexOutputStrategy(deps.fs, deps.jsonSchemaValidator, deps.assetProvider)`.
  - Wire it into the `framework.ts` action: when `target === "codex"`, use this factory; else use the existing default (Mode A) or flat factory.
- `src/domain/models/framework-build.ts`:
  - Widen `FrameworkBuildTarget` from `"copilot"` to `"copilot" | "codex"`.

**Test gates**:
1. `tests/e2e/framework-build.e2e.test.ts` (extended):
   - New scenario: invoke the CLI binary with `framework build --source <fixture> --target codex --out <tmp>`, assert exit code 0, assert success message matches spec wording, assert tree shape (smoke-level: marketplace.json + plugin.json + at least one TOML present).
2. Existing e2e copilot/flat scenarios continue to pass.
3. Manual smoke (documented in plan, run by reviewer): `aidd marketplace add aidd-fw /tmp/dist-codex --yes && aidd plugin install aidd-dev --tool codex --yes` against the codex output (AC #11 — manual gate; not automated because the marketplace+install path is consumer-side and outside this SDLC's scope).

**Exit criterion**: All tests green. CLI invocation produces the documented output. Updated command help mentions codex. Maps to spec AC #11 (manual), #12 (automated).

**Commit**: `feat(framework-build): wire --target codex through CLI`.

---

## 3. Do-not-duplicate list (must wrap or reuse, never reinvent)

| Surface | Reuse path | Risk if duplicated |
|---|---|---|
| `BuildOutputStrategy` interface | Implement, do not redefine. | Drift between Mode A / Codex contracts. |
| `FrameworkBuildUseCase` orchestrator | Inject strategy via constructor; do not subclass or fork. | Diverges from `guardPaths`, `readSourceMarketplace`, `warnOutOfScopeSections` semantics. |
| `InvalidBuildPathsError`, `JsonSchemaValidationError`, `FrameworkPlaceholderInPluginError`, `InvalidSourceMarketplaceError` | Throw from `domain/errors.ts`. | Spec AC #10 requires verbatim class names. |
| `assertNoToolsPlaceholder` | Call from `shared-plugin-helpers.ts`. | Inconsistent placeholder semantics. |
| `rewriteRelativeLinks` (for `.md` content) | Direct call with default `resolveTargetPath`. | Forking would duplicate the regex + dirname logic and miss edge cases (`posix.relative` handling). |
| `parseFrontmatter`, `serializeFrontmatter` | From `formats/markdown.ts`. | Edge cases around YAML quoting + trailing newlines diverge. |
| `stringifyToml` | From `formats/toml.ts` (wraps `smol-toml`). | New TOML serializer would lose determinism guarantees and `smol-toml` quoting rules. |
| `OUT_OF_SCOPE_PLUGIN_SECTIONS` | From `domain/models/framework-build.ts`. | Drift in which directories are skipped. |
| `SOURCE_PLUGIN_MANIFEST_RELATIVE`, `SOURCE_MARKETPLACE_RELATIVE` | From `domain/models/framework-build.ts`. | Source layout assumption drift. |
| `PluginPresenceFlags` | Reuse via Phase 2 extracted helper. | Codex synthesis logic would diverge from Mode A. |
| **`rewriteClaudeRootInJson` / `rewriteJsonFile`** | **DO NOT REUSE** for codex hooks/MCP — copy bytes. | **D-7 — silent semantic break: rewriting `${CLAUDE_PLUGIN_ROOT}/` to `./` would prevent Codex from expanding the variable, breaking hook command paths.** |
| `stripAgentFrontmatter` (Copilot allowlist) | DO NOT REUSE for codex agents. | Wrong target — Codex TOML schema is `name`/`description`/`developer_instructions`/`model?`. |
| `copilot-plugin-marketplace.json` schema | DO NOT REUSE for codex marketplace. | D-1 — required-key sets differ; would reject all valid codex outputs. |
| `MarketplaceOutputStrategy.emitMarketplaceCopilot` | Inspect for pattern, do not call. | Output path and shape differ. Reuse the version/description resolvers extracted in Phase 2. |
| `MarketplaceOutputStrategy.synthesizePluginManifest` | Inspect for pattern, do not call. | Output path and `agents` field differ. Reuse `PluginPresenceFlags` + D-17 passthrough fields only. |

---

## 4. Risks + mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | Implementer reuses `rewriteJsonFile` for codex hooks/MCP (lazy reuse), silently breaking `${CLAUDE_PLUGIN_ROOT}` expansion. | Medium | High (breaks AC #7/#8 with no test failure on AC #1/#2). | Phase 3 test asserts SHA-256 byte equality between source and dest for hooks/MCP — guaranteed to fail if the rewrite is applied. Do-not-duplicate list row #11 is explicit. |
| R-2 | TOML output non-deterministic due to object key iteration order, breaking AC #2 idempotency. | Low | Medium | D-15 fixes insertion order. Phase 1 test asserts byte-identical output across two emits. |
| R-3 | New Codex plugin manifest schema rejects a legitimate field shipped by docs but not on our allowlist (e.g. `interface`). | Low | Medium | Schema allows `interface` per docs. `additionalProperties: false` is intentional — failure surfaces in Phase 3 integration tests against the real fixture. If a real field is missed, the failure mode is loud (ajv error) not silent. |
| R-4 | The new `claude-marketplace-manifest.json` schema rejects a real fixture field. | Low | Medium | Schema uses `additionalProperties: true` for top-level and plugin entries (D-1). Test in Phase 1 validates the real fixture. |
| R-5 | Method-size limit (≤20 LOC) violated in `CodexOutputStrategy` if the implementer inlines synthesis + validation + write in one method. | Medium | Low | Plan pre-splits into `writePluginManifest` calling `synthesizeCodexPluginManifest` (separate private) — each ≤20 LOC. Biome check will catch it at commit. |
| R-6 | Phase 2 refactor breaks an existing Mode A or flat test by accidentally changing extraction semantics. | Low | High (rolls back Phase 2). | Phase 2 acceptance gate: existing test suite green count must equal pre-phase count. No new behavior; only function relocation. |
| R-7 | `${CLAUDE_PLUGIN_ROOT}` rewrite policy for skills (D-3) turns out to be wrong for a downstream Codex consumer expectation. | Low | Medium (downstream UX issue, not a build correctness issue). | Localized in `rewriteRelativeLinks` and reversible — a follow-up ticket can flip the policy with a small change. Documented as a C-level decision (chosen with rationale, not M-level locked). |
| R-8 | `--target codex` widening in `FrameworkBuildTarget` triggers exhaustiveness errors elsewhere in the codebase. | Low | Low | TypeScript will surface them at compile time. Phase 4 type-checks before commit. |
| R-9 | Source-marketplace `owner` field shape varies across fixtures (object vs string). | Low | Low | Pass through verbatim via `sourceMarketplace.owner` (`unknown` in current types). Bundled schema permits both. |
| R-10 | An agent file has `frontmatter.name` containing characters that `smol-toml` can't represent without escaping. | Low | Medium | `smol-toml` handles standard TOML string escaping. Phase 1 test seeds an agent name with `"` and `\n` and asserts round-trip via `parseToml(stringifyToml(...))`. |

---

## 5. Validation commands

Run per phase, before commit:

```bash
# All phases
pnpm biome check --write
pnpm typecheck

# Phase 1
pnpm vitest run tests/domain/formats/codex-agent-toml.unit.test.ts
pnpm vitest run tests/domain/formats/codex-paths.unit.test.ts || true   # only if a sanity test exists
pnpm vitest run tests/infrastructure/assets/                            # asset loader picks up the new schemas

# Phase 2
pnpm vitest run tests/application/use-cases/framework/   # regression — should not change green count

# Phase 3
pnpm vitest run tests/application/use-cases/framework/codex-output-strategy.integration.test.ts
pnpm vitest run tests/application/use-cases/framework/   # full framework suite

# Phase 4
pnpm vitest run tests/e2e/framework-build.e2e.test.ts
pnpm vitest run                                          # full suite
pnpm build && node dist/cli.js framework build --source tests/fixtures/framework-real --target codex --out /tmp/dist-codex-smoke
ls /tmp/dist-codex-smoke/.claude-plugin/marketplace.json
ls /tmp/dist-codex-smoke/plugins/aidd-dev/.codex-plugin/plugin.json
ls /tmp/dist-codex-smoke/plugins/aidd-dev/codex-agents/planner.toml

# Phase 4 — bundle-size budget (constraint: <500 KB)
pnpm pack --dry-run | tail -20   # reports packaged size; assert remains <500 KB
du -sh dist/                     # spot-check bundle directory size
```

---

## 6. Spec AC coverage matrix

| Spec AC # | Covered by phase | Test gate |
|---|---|---|
| 1 (tree shape) | Phase 3 | `codex-output-strategy.integration.test.ts` tree-shape assertion |
| 2 (idempotency) | Phase 1, Phase 3 | TOML determinism unit test + integration two-run byte-identity |
| 3 (codex plugin manifest schema valid) | Phase 1, Phase 3 | Schema unit test + integration re-validation |
| 4 (marketplace schema valid) | Phase 1, Phase 3 | Schema unit test + integration re-validation |
| 5 (every agent → TOML, required keys present) | Phase 1, Phase 3 | TOML unit tests + integration TOML parse loop |
| 6 (skill `.md` rewrite) | Phase 3 | Skill rewrite integration assertion |
| 7 (hooks byte-for-byte) | Phase 3 | SHA-256 equality assertion |
| 8 (MCP byte-for-byte) | Phase 3 | SHA-256 equality assertion |
| 9 (`agents` field omitted; warn-out-of-scope) | Phase 3 | Manifest-shape assertion + warn capture |
| 10 (error classes verbatim) | Phase 3 | Invalid-manifest + invalid-paths + tools-placeholder integration assertions |
| 11 (smoke E2E) | Phase 4 | Manual gate (documented commands above) |
| 12 (unit + integration coverage) | Phases 1–3 | Test gates listed per phase |

---

## 7. Out-of-scope (deferred)

- Codex `--flat` mode (D-12).
- Codex `--force` flag (D-13).
- Codex `apps` plugin field (spec §"Out of scope").
- Re-implementing the AI-side `plugin install --tool codex` runtime install flow (spec §"Out of scope").
- Model id mapping table (D-5).
- Targets other than codex (cursor / opencode are separate SDLCs).
- Schema autoload via `import ... with { type: "json" }` (current asset loader reads from disk — matches existing copilot pattern).
