---
name: framework-build-multi-target-marketplace
status: planned
objective: Extend `aidd framework build` marketplace mode to cover claude + cursor (copilot + codex already shipped; opencode deferred), and replace the framework.ts if/else strategy ladder with a (target,mode)→factory registry — copilot/codex output stays byte-identical.
success_condition: "pnpm biome check && pnpm typecheck && pnpm vitest run all green, AND `node dist/cli.js framework build --source tests/fixtures/framework-real --target cursor --out /tmp/dist-cursor` exits 0 producing `.cursor-plugin/marketplace.json` + `plugins/<p>/.cursor-plugin/plugin.json` (no `tools`/`color` in agent .md), AND `--target claude` produces `.claude-plugin/marketplace.json` + `plugins/<p>/.claude-plugin/plugin.json`, AND copilot+codex golden snapshots are byte-identical to pre-refactor baseline."
iteration: 0
created_at: 2026-05-30
date: 2026-05-30
targets: [claude, cursor]
mode: marketplace (Mode A)
spec: ./2026_05_30-framework-build-multi-target-marketplace-spec.md
phases: 5
---

# Plan — `aidd framework build` multi-target marketplace (claude + cursor)

## 0. Reuse inventory (mandatory)

| # | Capability needed | Existing helper / class | Reuse decision | Rationale |
|---|---|---|---|---|
| 1 | Strategy abstraction | `BuildOutputStrategy` (`strategies/build-output-strategy.ts`) | Direct (implement interface) | Spec §"Reuse contract": claude + cursor become implementations 4 and 5. Interface has every per-plugin hook; `writeRules`/`writeCommands` deliberately absent — no cursor `.mdc` work. |
| 2 | Orchestrator (path guard, source-marketplace parse, halt-at-first-failure, warn-out-of-scope, totals) | `FrameworkBuildUseCase` (`framework-build-use-case.ts`) | Direct — inject strategy, no orchestrator change | `execute()` iterates `sourceMarketplace.plugins` and calls `strategy.write*` + `postBuild`. New strategies slot in via constructor arg. |
| 3 | `${CLAUDE_PLUGIN_ROOT}` + `@./X`, `@../X` rewriting in `.md` | `rewriteRelativeLinks` (`formats/relative-link-rewrite.ts`) | Direct (default `resolveTargetPath`) | Spec §"Cursor specifics" + §"Reuse contract". Claude and Cursor consume Claude-format content; same Mode A rewrite the copilot/codex skill paths already use. See D-4. |
| 4 | `@{{TOOLS}}/` guard | `assertNoToolsPlaceholder` (`shared-plugin-helpers.ts`) | Direct | Same placeholder contract as copilot/codex (`FrameworkPlaceholderInPluginError`). |
| 5 | Frontmatter parse / serialize | `parseFrontmatter`, `serializeFrontmatter` (`formats/markdown.ts`) | Direct | Claude + Cursor agents emit `.md` with frontmatter (unlike codex TOML). Both parse and serialize used. |
| 6 | Plugin presence detection | `detectPluginPresenceFlags`, `listSkillNames`, `hasAgentFiles` (`marketplace-strategy-helpers.ts`) | Direct | Module already extracted (codex SDLC Phase 2 shipped). Identical logic for claude/cursor manifest synthesis. |
| 7 | Skill tree copy + `.md` rewrite | `writeSkillTree` (`marketplace-strategy-helpers.ts`) | Direct | Spec §"Per-tool delta": skills `skills/<n>/SKILL.md` 1:1 for all four targets — identical Mode A layout. Cursor skills are Claude-compatible (no rewrite of frontmatter). |
| 8 | Version / description resolver | `resolveVersion`, `resolveDescription` (`marketplace-strategy-helpers.ts`) | Direct (parameterize manifest path) | Same resolution: source-entry first, else plugin.json, else `InvalidSourceMarketplaceError`. Pass `OUTPUT_CLAUDE_MANIFEST_RELATIVE` / `OUTPUT_CURSOR_MANIFEST_RELATIVE`. |
| 9 | Claude marketplace bundled schema | `assets/schemas/claude-marketplace-manifest.json` + `loadSchema("claude-marketplace")` | Direct | Spec §"Acceptance criteria" #1. Already bundled + keyed (codex SDLC). Claude target validates against it. |
| 10 | Cursor marketplace bundled schema | `loadSchema("claude-marketplace")` | Direct (NOT a clone) — see D-2 | Spec §"Per-tool delta": cursor marketplace schema = claude-clone (`name`/`owner`/`plugins[]`). Required-key set is identical → reuse the bundled claude schema; do NOT add a new file. |
| 11 | Plugin manifest synthesis bookkeeping (name/description/version/author/homepage/repository/license/keywords + skills/agents/hooks/mcp per presence) | `MarketplaceOutputStrategy.synthesizePluginManifest` (Copilot-local private) | Extract to shared helper in Phase 2 (`synthesizeClaudeStyleManifest`) | Claude + Cursor manifests are byte-identical in field set to the current Copilot synthesis (`agents: ["./agents"]`, `skills`, `hooks`, `mcpServers`). Spec mandates ONE shared helper parameterized by `{manifestDir, agentsField}`. Codex keeps its own (no `agents`). |
| 12 | Hooks JSON copy / rewrite | `MarketplaceOutputStrategy.rewriteJsonFile` (Copilot-local private) | Reference + extract minimal — see D-6 | Copilot rewrites `${CLAUDE_PLUGIN_ROOT}/`→`./` in hooks/mcp JSON. Claude + Cursor target the Claude runtime which expands `${CLAUDE_PLUGIN_ROOT}` natively → BYTE-FOR-BYTE copy (like codex), not the rewrite. See D-6. |
| 13 | Marketplace emission shape | `MarketplaceOutputStrategy.emitMarketplaceCopilot` / `CodexOutputStrategy.buildCodexMarketplaceObject` | Reference codex (Claude shape) | Codex already emits the exact Claude-shape marketplace object claude+cursor need (`{name, version?, description?, owner, plugins:[{name, source:"./plugins/<n>", description, version, strict?, recommended?}]}`). Extract that builder in Phase 2; reuse for claude + cursor. |
| 14 | Path-pair safety guard | `InvalidBuildPathsError` + `FrameworkBuildUseCase.guardPaths` | Direct (orchestrator runs it) | Spec §"Safety guard" identical to shipped behavior. No new error class. |
| 15 | Out-of-scope warn (`commands/`, `rules/`) | `OUT_OF_SCOPE_PLUGIN_SECTIONS` + `warnOutOfScopeSections` | Direct (orchestrator runs it) | Spec AC #6 — warn-and-skip for all targets. This is why cursor needs NO `.mdc` emitter. |
| 16 | Agent frontmatter allowlist | `stripAgentFrontmatter` + `COPILOT_AGENT_FRONTMATTER_KEYS` (`formats/agent-frontmatter-strip.ts`) | Extend — add cursor allowlist + generic picker (D-3) | Copilot allowlist includes `tools`. Cursor must emit `name`/`description`/`model` ONLY (spec hard constraint). Add `CURSOR_AGENT_FRONTMATTER_KEYS = ["name","description","model"]` + parameterize the picker. Claude reuses the full Claude-format `.md` (byte-copy of agent files — D-5). |
| 17 | Strategy selection in command | `framework.ts` ternary ladder (`createCodexFrameworkBuildUseCase` / `createFlatFrameworkBuildUseCase` / `deps.frameworkBuildUseCase`) | Replace with `(target,mode)→factory` registry in `deps.ts` (D-1) | Spec §"Architecture": keyed registry so the later flat phase adds rows, not a refactor. |
| 18 | Deps factories | `infrastructure/deps.ts` (`createCodexFrameworkBuildUseCase`, `createFlatFrameworkBuildUseCase`) | Extend (add claude + cursor factories; assemble registry) | Mirror the codex factory (constructs strategy, wires `FrameworkBuildUseCase`). |
| 19 | Schema loader keying | `SchemaName` union (`asset-provider.ts`) + `asset-loader.ts` map | Reference only — NO new key | D-2: cursor reuses `"claude-marketplace"`. No `SchemaName` change unless a cursor-specific plugin-manifest schema is needed (it is not — claude plugin manifest schema `claude-code-plugin-manifest.json` covers both; see D-7). |

---

## 1. Decisions

Status legend: **M** = must / locked; **C** = chosen with rationale; **D** = deferred / out-of-scope.

### D-1 (M) — Strategy selection is a `(target, mode) → factory` registry, NOT a ladder

**Decision**: Replace the `framework.ts` ternary (lines 64–69) with a registry assembled in `deps.ts`:

```text
key = `${target}:${mode}`
registry["claude:marketplace"]   → ClaudeOutputStrategy
registry["cursor:marketplace"]   → CursorOutputStrategy
registry["copilot:marketplace"]  → CopilotOutputStrategy   (renamed from MarketplaceOutputStrategy)
registry["copilot:flat"]         → FlatOutputStrategy        (existing)
registry["codex:marketplace"]    → CodexOutputStrategy
```

**Shape**: `deps.ts` exposes `createFrameworkBuildUseCase(deps, { target, mode, outDir, force }): FrameworkBuildUseCase` that looks up a factory by key and throws/returns-undefined for an unknown pair. The flat factory still needs `outDir` + `force`; the registry values are factory functions `(deps, ctx) => FrameworkBuildUseCase`, not pre-built instances, so flat's per-invocation args are passed through `ctx`. Command resolves the use-case by key; an unknown key surfaces the existing "Unsupported target/mode" error path (`output.error` + `process.exit(1)`).

**Rationale**: Spec §"Architecture" is explicit and cites the advisor steer — keyed on `(target, mode)` so the flat phase adds `opencode:flat`, `cursor:flat`, `codex:flat` rows without touching `framework.ts`. Avoids a second refactor.

**Constraint**: The registry refactor must change NOTHING observable for copilot + codex (spec AC #3) — same strategy instances, same wiring args. Phase 1 is gated by the golden snapshot proving byte-identity.

### D-2 (M) — Cursor marketplace schema = REUSE `claude-marketplace`, no clone

**Decision**: Cursor target validates its emitted marketplace against the already-bundled `assets/schemas/claude-marketplace-manifest.json` via `loadSchema("claude-marketplace")`. Do NOT add a `cursor-marketplace` schema file or `SchemaName` member.

**Rationale**: Spec §"Per-tool delta" and §"Confirmed via research": Cursor's marketplace schema is a Claude clone — `name`/`owner`/`plugins[]`, plugin entries `source: "./plugins/<name>"`. The required-key set is identical to claude's. Spec §"Net new code" gates a clone ONLY IF "required-key set differs from claude's" — it does not. Adding an identical-shape file would be dead duplication (`7-clean-code` DRY). If a future Cursor schema diverges, add the key then.

**Reversal trigger**: If integration testing reveals a required Cursor-only marketplace key absent from the claude schema, add `"cursor-marketplace"` to `SchemaName` + a bundled file in a follow-up — localized, non-blocking.

### D-3 (M) — Cursor agent frontmatter: `name`/`description`/`model` ONLY; never `tools`/`color`

**Decision**: Add `CURSOR_AGENT_FRONTMATTER_KEYS = ["name", "description", "model"]` to `formats/agent-frontmatter-strip.ts` and refactor `stripAgentFrontmatter` into a generic `pickFrontmatterKeys(fm, keys)` with two named wrappers (`stripCopilotAgentFrontmatter`, `stripCursorAgentFrontmatter`) — or keep `stripAgentFrontmatter` as the copilot wrapper and add a cursor wrapper. `CursorOutputStrategy.writeAgents` parses frontmatter, picks the cursor allowlist (drops `tools`/`color`/everything else), rewrites the body via `rewriteRelativeLinks`, and re-serializes.

**Rationale**: Spec hard constraint — "emit `name`/`description`/`model` only — NEVER inject `tools`/`color` (Cursor doesn't document them)". The shipped Copilot allowlist includes `tools` and `agents`/`argument-hint`, so it cannot be reused as-is. Generic picker satisfies `7-clean-code` DRY (≥2 callers).

**Test gate**: A fixture agent with `tools:`, `color:`, `argument-hint:` in source frontmatter → cursor output `.md` frontmatter contains exactly `name`, `description`, `model` (when present) and none of the dropped keys. Spec AC #2.

### D-4 (M) — `@./`, `@../`, `@${CLAUDE_PLUGIN_ROOT}/` in `.md` bodies → REWRITE (default Mode A)

**Decision**: Both claude and cursor pass `.md` skill + agent bodies through `rewriteRelativeLinks` with the default `resolveTargetPath` (identity), same as the shipped copilot/codex skill path. Bare `${CLAUDE_PLUGIN_ROOT}` without a leading `@` is left untouched (the helper already does this — spec C-v2.2).

**Rationale**:
1. Reuse mandate — `rewriteRelativeLinks` already implements the exact transform; the spec §"Cursor specifics" says "follow the same rule the shipped strategies use (`relative-link-rewrite.ts`)".
2. Claude is the source format and Cursor skills are Claude-compatible; both render markdown links identically to claude/copilot output.
3. The spec flagged "plan locks whether Cursor preserves or rewrites `${CLAUDE_PLUGIN_ROOT}`" — **locked to REWRITE** for `@`-prefixed refs (consistency with all shipped strategies); bare occurrences are preserved by the helper's existing behavior.

**Scope**: Applies to skill `.md` bodies AND agent `.md` bodies for claude + cursor. (Codex preserves agent bodies verbatim because they land in TOML — different target, not in scope here.)

### D-5 (M) — Claude agents: byte-copy of `.md` (full Claude frontmatter), body rewritten

**Decision**: `ClaudeOutputStrategy.writeAgents` copies each source `agents/*.md` preserving its full frontmatter (Claude is the source format — no allowlist strip), rewriting only the body via `rewriteRelativeLinks`. No frontmatter keys are dropped.

**Rationale**: Spec §"Per-tool delta": claude agents file format is `.md` byte copy; §"Claude specifics": "Copy plugin trees byte-for-byte". Claude consumes its own native frontmatter (`tools`, `color`, `model`, etc. are all valid). Stripping would corrupt the identity-style copy. Contrast cursor (D-3) which strips to the minimal documented set.

**Decision note**: "byte-copy" for agents means frontmatter is preserved verbatim, but the body still gets the `@`-link rewrite (D-4) for consistency with the source-format expectation that `@`-shorthand expands. If a strict byte-for-byte (no body rewrite) reading is required, the integration test fixture will decide; default is rewrite-body to match every other shipped strategy. **Locked: rewrite body, preserve frontmatter.**

### D-6 (M) — Claude + Cursor hooks/MCP JSON → BYTE-FOR-BYTE copy (no `${CLAUDE_PLUGIN_ROOT}` rewrite)

**Decision**: For both new strategies, `hooks/hooks.json` (+ sibling files) and `.mcp.json` are copied via raw `fs.readFile` → `fs.writeFile`. Do NOT call `rewriteClaudeRootInJson` / the Copilot `rewriteJsonFile`.

**Rationale**: Claude and Cursor runtimes expand `${CLAUDE_PLUGIN_ROOT}` natively (Cursor adopted the Claude plugin spec; Claude IS the source). The Copilot rewrite (`${CLAUDE_PLUGIN_ROOT}/`→`./`) exists because Copilot's `.github/plugin` workspace has different path semantics. Rewriting for claude/cursor would break native expansion — identical reasoning to codex D-7. Byte-for-byte also guarantees idempotency (spec AC #4) with no JSON re-serialization key-order risk.

**Note**: The framework ships no `.mcp.json` today (spec §"Out of scope" — MCP no-op for current inputs), so `writeMcp` is exercised only by a dedicated fixture if one is added; the code path must still be correct.

### D-7 (M) — Claude + Cursor plugin manifest schema → REUSE `claude-code-plugin-manifest.json`

**Decision**: Validate the synthesized `.claude-plugin/plugin.json` (claude) and `.cursor-plugin/plugin.json` (cursor) against the already-bundled `assets/schemas/claude-code-plugin-manifest.json`. Confirm the loader exposes a key for it; if not currently keyed, add `"plugin-manifest"` reuse (it maps to `claude-code-plugin-manifest.json` per the existing `plugin-manifest` SchemaName member). No new schema file.

**Rationale**: Both manifests carry the Claude plugin shape (`name`/`version`/`description`/`author`/`skills`/`agents`/`hooks`/`mcpServers`). Cursor adopted the Claude plugin spec. The bundled claude plugin-manifest schema is the correct validator for both. Adding cursor/claude-specific manifest schemas would duplicate. **Verify in Phase 3** that the synthesized output validates; if `additionalProperties:false` rejects a field, relax the bundled schema or the synthesis (loud failure, caught by integration test).

### D-8 (M) — One shared manifest synthesis helper `synthesizeClaudeStyleManifest`

**Decision**: Extract Copilot's `synthesizePluginManifest` into `marketplace-strategy-helpers.ts` as:

```text
synthesizeClaudeStyleManifest(source: Record<string,unknown>, presence: PluginPresenceFlags, opts: { manifestDir: string; agentsField: boolean }): Record<string,unknown>
```

Field set: passthrough `name`/`description`/`version`/`author`/`homepage`/`repository`/`license`/`keywords`; `agents: ["./agents"]` when `opts.agentsField && presence.hasAgents`; `skills` per `presence.skillsList`; `hooks: "./hooks/hooks.json"` per presence; `mcpServers: "./.mcp.json"` per presence. `opts.manifestDir` is `.claude-plugin` (claude) | `.cursor-plugin` (cursor); used by the strategy to compute the dest path, not embedded in the manifest body. `agentsField = true` for both claude and cursor.

**Rationale**: Spec §"Architecture" + §"Net new code" mandate exactly this signature, shared by claude + cursor. Codex keeps `synthesizeCodexPluginManifest` (no `agents`, different paths). Copilot's `synthesizePluginManifest` is byte-identical in field output today, so Copilot is refactored to call `synthesizeClaudeStyleManifest(source, presence, { manifestDir: ".github/plugin", agentsField: true })` — **must produce byte-identical Copilot manifests** (regression guard, spec AC #3). The Copilot manifest dest path is `${COPILOT_WORKSPACE_DIR}plugin/plugin.json`; confirm the extracted helper does not change the emitted JSON body.

**Risk**: Copilot's current dest is `OUTPUT_PLUGIN_MANIFEST_RELATIVE` (`.github/plugin/plugin.json`); the helper must keep the body identical. Phase 1 golden snapshot is the gate.

### D-9 (M) — Shared Claude-shape marketplace builder

**Decision**: Extract the Claude-shape marketplace object builder (currently `CodexOutputStrategy.buildCodexMarketplaceObject` + `buildCodexMarketplaceEntry`) into `marketplace-strategy-helpers.ts` as a parameterized `buildClaudeStyleMarketplace(...)` reused by claude + cursor + codex. Codex's call site switches to the shared helper.

**Rationale**: Claude, Cursor, and Codex all emit the identical Claude-shape marketplace catalog (`{name, version?, description?, owner, plugins:[{name, source:"./plugins/<n>", description, version, strict?, recommended?}]}`). Copilot keeps its own (`metadata.pluginRoot` shape). DRY via fuller helpers (spec §"Architecture"). Codex output must remain byte-identical (AC #3) — the extraction is behavior-preserving.

**Conservative alternative**: If extracting from codex risks codex byte-drift, claude+cursor get a fresh shared builder and codex is left untouched. **Locked: extract + reuse; gate with codex golden snapshot. If the snapshot drifts, fall back to leaving codex's private builder in place and duplicate the ≤15-LOC builder for claude+cursor (recorded as acceptable, since it's small and the cross-target share is the nicety, not the requirement).**

### D-10 (M) — `FrameworkBuildTarget` union widened to four targets

**Decision**: `framework-build.ts:4`: `"copilot" | "codex"` → `"claude" | "cursor" | "copilot" | "codex"`. TypeScript exhaustiveness errors elsewhere are surfaced at typecheck and fixed in the same phase.

### D-11 (M) — New path constants in `cursor-paths.ts` + claude constants

**Decision**: Add `src/domain/formats/cursor-paths.ts` (mirror of `codex-paths.ts`):

```text
OUTPUT_CURSOR_MANIFEST_RELATIVE    = ".cursor-plugin/plugin.json"
OUTPUT_CURSOR_MARKETPLACE_RELATIVE = ".cursor-plugin/marketplace.json"
```

For claude, add (in `cursor-paths.ts` companion or a new `claude-build-paths.ts`, plan picks `claude-build-paths.ts` for locality):

```text
OUTPUT_CLAUDE_MANIFEST_RELATIVE    = ".claude-plugin/plugin.json"
OUTPUT_CLAUDE_MARKETPLACE_RELATIVE = ".claude-plugin/marketplace.json"
```

**Rationale**: Spec §"Net new code" names `cursor-paths.ts` explicitly as a mirror of `codex-paths.ts`. Claude constants are distinct from `SOURCE_PLUGIN_MANIFEST_RELATIVE`/`SOURCE_MARKETPLACE_RELATIVE` even though literals coincide — same locality reasoning codex-paths documents (future changes must not collapse output vs source).

### D-12 (M) — Rename `MarketplaceOutputStrategy` → `CopilotOutputStrategy`

**Decision**: Rename the class + file (`marketplace-output-strategy.ts` → `copilot-output-strategy.ts`), update all imports (`deps.ts`, tests). Clarity only — no behavior change.

**Rationale**: Spec scope table. The class name no longer describes its role once three other marketplace strategies exist. Byte-identical Copilot output (AC #3) is the gate. **Test files referencing the old name must be updated in the same commit.**

### D-13 (M) — No base class; extend helper composition

**Decision**: No abstract base class. Claude + Cursor are parallel `BuildOutputStrategy` implementations sharing free functions in `marketplace-strategy-helpers.ts` (`7-clean-code` YAGNI, `1-exports` no-default).

### D-14 (M) — `--flat` guard unchanged (copilot-only this phase)

**Decision**: `framework.ts` `--flat` guard stays copilot-only; `--force` stays flat-only. Claude/cursor flat is the later flat phase.

**Rationale**: Spec §"Out of scope": flat mode for claude/cursor/codex is a later phase. Registry has no `claude:flat`/`cursor:flat` rows yet → unknown-key error path covers them.

### D-15 (D) — OpenCode target → deferred

**Decision**: Out of scope (no native marketplace). Belongs to the flat phase. Registry gains `opencode:flat` later without touching `framework.ts`.

### D-16 (D) — Cursor `.mdc` rules + commands emitters → out of scope

**Decision**: No `writeRules`/`writeCommands` on the interface; framework ships no rules/commands source; `commands/`/`rules/` warn-and-skip (AC #6). Emitting them would be dead code.

---

## 2. Phases

Each phase = one conventional commit boundary unless noted. Sequence matches spec: (1) registry+union+guard regression guard, (2) shared helpers + path constants, (3) claude, (4) cursor, (5) tests + smoke.

### Phase 1 — Registry refactor + union + command guard (regression guard)

**Layer skill**: `command` (governs `framework.ts` thin-wrapper) + deps wiring (`0-deps-wiring.md`).

**Objective**: Replace the `framework.ts` ladder with a `(target,mode)→factory` registry in `deps.ts`. Widen the union and target guard to accept the four targets (claude/cursor route to a not-yet-implemented factory that the registry leaves absent → unknown-key error until Phase 3/4 register them). Prove copilot + codex output is byte-identical (AC #3). **No new strategy logic.**

**Files modified**:
- `src/domain/models/framework-build.ts` — widen `FrameworkBuildTarget` to `"claude" | "cursor" | "copilot" | "codex"` (D-10).
- `src/infrastructure/deps.ts` — add `frameworkBuildUseCaseRegistry` / `createFrameworkBuildUseCase(deps, ctx)` that maps `${target}:${mode}` → factory. Wire existing `copilot:marketplace` (default Mode A), `copilot:flat` (flat), `codex:marketplace` (codex). Leave `claude:*` / `cursor:*` unregistered for now (D-1).
- `src/application/commands/framework.ts` — relax target guard to accept the four targets; replace the ternary (lines 64–69) with a single registry lookup by `${target}:${mode}`; unknown pair → existing `output.error(...)` + `process.exit(1)`. Update `--target` option help string and command `.description(...)`. Keep `--flat`/`--force` guards (D-14): `--flat` still copilot-only, `--force` still flat-only.
- Update any test referencing the old wiring.

**Files added**: none.

**Test gate**:
- `pnpm biome check --write` + `pnpm typecheck` clean (exhaustiveness surfaced by D-10).
- `pnpm vitest run tests/golden/golden-baseline.e2e.test.ts` — **byte-identical** to stored `snapshots/phase0/snapshot.json` for copilot (+ codex if in matrix). This is the AC #3 regression proof. If codex is not yet in the golden matrix, add a focused two-run byte-identity assertion for `--target copilot` and `--target codex` against `tests/fixtures/framework-real`.
- `pnpm vitest run tests/e2e/framework-build.e2e.test.ts` + `tests/application/use-cases/framework/` — unchanged green count.
- Unknown-target / unknown-pair (`--target claude` before Phase 3) → error path, exit 1, no crash (AC #5).

**Exit criterion**: copilot + codex byte-identical; `claude`/`cursor` accepted by the guard but resolve to the unknown-key error (temporary, until Phase 3/4). Maps to spec AC #3 (partial — copilot/codex), #5.

**Commit**: `refactor(framework-build): replace strategy ladder with (target,mode) registry`.

---

### Phase 2 — Shared helpers + path constants (pure refactor, no behavior change)

**Layer skill**: `format` (path constants, frontmatter picker) + `use-case` (strategy helpers).

**Objective**: Land the shared pieces claude + cursor consume, refactoring copilot/codex to use them with **zero observable change**. All existing tests green at the same count.

**Files added**:
- `src/domain/formats/cursor-paths.ts` — `OUTPUT_CURSOR_MANIFEST_RELATIVE`, `OUTPUT_CURSOR_MARKETPLACE_RELATIVE` (D-11).
- `src/domain/formats/claude-build-paths.ts` — `OUTPUT_CLAUDE_MANIFEST_RELATIVE`, `OUTPUT_CLAUDE_MARKETPLACE_RELATIVE` (D-11).

**Files modified**:
- `src/application/use-cases/framework/strategies/marketplace-strategy-helpers.ts` — add `synthesizeClaudeStyleManifest(source, presence, { manifestDir, agentsField })` (D-8) and `buildClaudeStyleMarketplace(...)` + entry builder (D-9). Each ≤20 LOC.
- `src/domain/formats/agent-frontmatter-strip.ts` — add `CURSOR_AGENT_FRONTMATTER_KEYS = ["name","description","model"]`; refactor to a generic `pickFrontmatterKeys(fm, keys)` with `stripCopilotAgentFrontmatter` / `stripCursorAgentFrontmatter` wrappers (D-3). `stripAgentFrontmatter` behavior preserved (alias or copilot wrapper).
- `src/application/use-cases/framework/strategies/marketplace-output-strategy.ts` (still copilot here; renamed in Phase 1 or this phase per D-12) — call `synthesizeClaudeStyleManifest(..., { manifestDir: ".github/plugin", agentsField: true })` instead of local `synthesizePluginManifest`. **Must emit byte-identical manifest.**
- `src/application/use-cases/framework/strategies/codex-output-strategy.ts` — switch `buildCodexMarketplaceObject`/entry to `buildClaudeStyleMarketplace` (D-9) IF byte-identical; else leave codex untouched and accept small duplication (D-9 fallback).
- Apply the D-12 rename here if not done in Phase 1 (`marketplace-output-strategy.ts` → `copilot-output-strategy.ts`, class `CopilotOutputStrategy`), updating `deps.ts` + tests.

**Test gate**:
- `marketplace-strategy-helpers.unit.test.ts` — extend: `synthesizeClaudeStyleManifest` presence permutations (no agents / agents / skills / hooks / mcp combos) × manifestDir variants (`.claude-plugin`, `.cursor-plugin`); `agentsField:false` omits `agents`. `buildClaudeStyleMarketplace` entry shape + `strict`/`recommended` passthrough.
- `agent-frontmatter-strip.unit.test.ts` — cursor allowlist drops `tools`/`color`/`argument-hint`; copilot allowlist unchanged; key order deterministic.
- `pnpm vitest run tests/golden/golden-baseline.e2e.test.ts` + `tests/application/use-cases/framework/` — **same green count, byte-identical copilot/codex snapshot** (the no-behavior-change gate, AC #3).

**Exit criterion**: helpers exist + unit-tested; copilot + codex output byte-identical; rename complete. Maps to AC #3 (preserved), #7 (helper presence logic), enabler for #1/#2.

**Commit**: `refactor(framework-build): shared claude-style manifest + marketplace helpers + cursor frontmatter allowlist`.

---

### Phase 3 — `ClaudeOutputStrategy` + registry registration + integration tests

**Layer skill**: `use-case` (strategy implementation).

**Objective**: Implement strategy #4. Register `claude:marketplace`. Cover AC #1, #4, #7 with integration tests against `tests/fixtures/framework-real`.

**Files added**:
- `src/application/use-cases/framework/strategies/claude-output-strategy.ts` implements `BuildOutputStrategy`:
  - `preBuild(outDir)` → wipe + recreate.
  - `writePluginManifest(...)` → read source `.claude-plugin/plugin.json`, `detectPluginPresenceFlags`, `synthesizeClaudeStyleManifest(source, presence, { manifestDir: ".claude-plugin", agentsField: true })`, validate against `loadSchema("plugin-manifest")` (D-7), write to `<out>/plugins/<p>/.claude-plugin/plugin.json` (`OUTPUT_CLAUDE_MANIFEST_RELATIVE`). Returns 1.
  - `writeAgents(...)` → iterate `agents/*.md`; per file: `assertNoToolsPlaceholder`, `parseFrontmatter`, preserve full frontmatter (D-5), `rewriteRelativeLinks` on body, `serializeFrontmatter`, write to `<out>/plugins/<p>/agents/<name>.md`. Returns count.
  - `writeSkills(...)` → `writeSkillTree` (Phase 6 helper). Returns count.
  - `writeHooks(...)` → byte-for-byte copy of `hooks/**` (D-6). Returns count.
  - `writeMcp(...)` → byte-for-byte copy of `.mcp.json` (D-6). Returns 0/1.
  - `postBuild(...)` → `buildClaudeStyleMarketplace`, validate against `loadSchema("claude-marketplace")`, write to `<out>/.claude-plugin/marketplace.json` (`OUTPUT_CLAUDE_MARKETPLACE_RELATIVE`). Returns 1.
- Each method ≤20 LOC.

**Files modified**:
- `src/infrastructure/deps.ts` — register `claude:marketplace` → factory constructing `ClaudeOutputStrategy(deps.fs, jsonSchemaValidator, deps.assetProvider)`.

**Test gate** (`claude-output-strategy.integration.test.ts`, `InMemoryFileAdapter` + `framework-real` fixture):
- Tree shape (AC #1): `.claude-plugin/marketplace.json`, `plugins/<p>/.claude-plugin/plugin.json`, `plugins/<p>/skills/<n>/SKILL.md`, `plugins/<p>/agents/*.md`, `plugins/<p>/hooks/hooks.json` (per presence).
- Marketplace schema valid (AC #1) — re-validate emitted catalog.
- Plugin manifest schema valid (D-7) — re-validate; assert `agents: ["./agents"]` present when source has agents (AC #7), absent otherwise.
- Idempotency (AC #4): two runs into same `<out>` → byte-identical every file.
- Agent frontmatter preserved (D-5): a source agent with `tools`/`color`/`model` → claude output keeps all.
- Hooks byte-for-byte (AC #1, D-6): SHA-256 source == dest.
- Out-of-scope warn (AC #6): `commands/`/`rules/` warn + absent in output.
- Safety guard (AC #5): `source === out` → `InvalidBuildPathsError`.
- `@{{TOOLS}}/` in content → `FrameworkPlaceholderInPluginError`.

**Exit criterion**: all green; `--target claude` resolves; method-size ≤20. Maps to AC #1, #4, #5, #6, #7.

**Commit**: `feat(framework-build): claude output strategy`.

---

### Phase 4 — `CursorOutputStrategy` + registry registration + integration tests

**Layer skill**: `use-case`.

**Objective**: Implement strategy #5 (the only real net-new build). Register `cursor:marketplace`. Cover AC #2.

**Files added**:
- `src/application/use-cases/framework/strategies/cursor-output-strategy.ts` implements `BuildOutputStrategy`:
  - `preBuild` → wipe + recreate.
  - `writePluginManifest(...)` → `synthesizeClaudeStyleManifest(source, presence, { manifestDir: ".cursor-plugin", agentsField: true })`, validate against `loadSchema("plugin-manifest")` (D-7), write to `<out>/plugins/<p>/.cursor-plugin/plugin.json` (`OUTPUT_CURSOR_MANIFEST_RELATIVE`).
  - `writeAgents(...)` → per `agents/*.md`: `assertNoToolsPlaceholder`, `parseFrontmatter`, `stripCursorAgentFrontmatter` (D-3 — `name`/`description`/`model` only, drops `tools`/`color`), `rewriteRelativeLinks` body (D-4), `serializeFrontmatter`, write to `<out>/plugins/<p>/agents/<name>.md`.
  - `writeSkills(...)` → `writeSkillTree` (Claude-compatible 1:1).
  - `writeHooks(...)` → byte-for-byte (D-6).
  - `writeMcp(...)` → byte-for-byte (D-6).
  - `postBuild(...)` → `buildClaudeStyleMarketplace`, validate against `loadSchema("claude-marketplace")` (D-2), write to `<out>/.cursor-plugin/marketplace.json` (`OUTPUT_CURSOR_MARKETPLACE_RELATIVE`).
  - Each method ≤20 LOC.

**Files modified**:
- `src/infrastructure/deps.ts` — register `cursor:marketplace` → factory constructing `CursorOutputStrategy(...)`.

**Test gate** (`cursor-output-strategy.integration.test.ts`):
- Tree shape (AC #2): same shape under `.cursor-plugin/` manifest dir; `.cursor-plugin/marketplace.json` validates against claude-clone schema (D-2).
- **Agent frontmatter (AC #2, D-3)**: source agent with `tools`/`color`/`argument-hint` → cursor output `.md` frontmatter has exactly `name`/`description`/`model` (present subset), NO `tools`/`color`.
- Idempotency (AC #4): two runs byte-identical.
- Skills 1:1 (AC #2): `SKILL.md` + supporting files copied; frontmatter unchanged.
- Out-of-scope warn (AC #6); safety guard (AC #5); `@{{TOOLS}}/` halt.
- `${CLAUDE_PLUGIN_ROOT}`/`@./`/`@../` rewrite in body (D-4) asserted on a fixture skill/agent body.

**Exit criterion**: all green; `--target cursor` resolves; no `tools`/`color` injected. Maps to AC #2, #4, #5, #6.

**Commit**: `feat(framework-build): cursor output strategy`.

---

### Phase 5 — Golden matrix + E2E + smoke doc

**Layer skill**: `test`.

**Objective**: Extend the golden command matrix with `--target claude` and `--target cursor` (machine-independent), add e2e journeys, document the `/tmp` smoke (AC #8, #9).

**Files modified**:
- `tests/golden/golden-baseline.e2e.test.ts` — add `framework build --target claude` and `--target cursor` rows to the command matrix against `tests/fixtures/framework-real`; regenerate `snapshots/phase0/snapshot.json` for the NEW rows only (copilot/codex rows must NOT change — AC #3). Normalization must be machine-independent: no absolute-path-derived values, no path-bearing content hashes (`.claude/skills/test/references/golden-machine-independence.md`).
- `tests/e2e/framework-build.e2e.test.ts` — add one journey per new target: invoke CLI binary, assert exit 0, success message `Built <N> plugins, <M> files written to <out>`, assert tree shape (marketplace.json + plugin.json + ≥1 skill/agent present).

**Files added**:
- `aidd_docs/tasks/2026_05/2026_05_30-framework-build-multi-target-marketplace-smoke.md` — documented manual smoke run, **in `/tmp` never repo root** (`.claude/skills/test/references/smoke-in-tmp.md`): build cursor + claude into `/tmp/<name>` with `git init`, `aidd marketplace add aidd-fw /tmp/dist-<t>`, `aidd plugin install aidd-dev --tool <t>`, assert exit 0 + manifest records the plugin (AC #9).

**Test gate**:
- `pnpm vitest run tests/golden/golden-baseline.e2e.test.ts` — two-capture byte-identity (determinism) + stored-baseline match; copilot/codex rows unchanged (AC #3, #8).
- `pnpm vitest run tests/e2e/framework-build.e2e.test.ts` — claude + cursor journeys green; existing copilot/flat green.
- `pnpm vitest run` — full suite green.
- Manual smoke (reviewer-run, documented) — AC #9.

**Exit criterion**: full suite green; golden matrix covers 4 targets, machine-independent; smoke doc present. Maps to AC #8, #9, and the test-plan tiers (unit/integration/e2e/golden/smoke).

**Commit**: `test(framework-build): golden + e2e matrix for claude & cursor + smoke doc`.

---

## 3. Do-not-duplicate list

| Surface | Reuse path | Risk if duplicated |
|---|---|---|
| `BuildOutputStrategy` interface | Implement, do not redefine. No `writeRules`/`writeCommands`. | Contract drift; dead cursor `.mdc` code. |
| `FrameworkBuildUseCase` orchestrator | Inject strategy via registry factory; never subclass. | Diverges from `guardPaths`/`readSourceMarketplace`/`warnOutOfScopeSections`. |
| `synthesizeClaudeStyleManifest` | One shared helper, claude+cursor+copilot. | Three near-identical synth functions; spec mandates one. |
| `buildClaudeStyleMarketplace` | One shared helper, claude+cursor+codex. | Marketplace-shape drift across targets. |
| `rewriteRelativeLinks` | Direct, default `resolveTargetPath`. | Forked regex/dirname logic, edge-case drift. |
| `writeSkillTree`, `detectPluginPresenceFlags`, `resolveVersion`, `resolveDescription`, `listSkillNames` | From `marketplace-strategy-helpers.ts`. | Presence/skill-copy logic divergence. |
| `claude-marketplace-manifest.json` schema | `loadSchema("claude-marketplace")` for claude AND cursor (D-2). | Redundant cursor schema file. |
| `claude-code-plugin-manifest.json` schema | `loadSchema("plugin-manifest")` for claude AND cursor (D-7). | Redundant per-target manifest schema. |
| **Copilot `rewriteJsonFile` / `rewriteClaudeRootInJson`** | **DO NOT REUSE** for claude/cursor hooks/MCP — copy bytes (D-6). | Silent break: `${CLAUDE_PLUGIN_ROOT}` no longer expands; idempotency risk from JSON re-serialize. |
| `stripAgentFrontmatter` (Copilot allowlist incl. `tools`) | **DO NOT REUSE** for cursor — use `stripCursorAgentFrontmatter` (D-3). | Injects `tools` into cursor agents — violates hard constraint. |
| `InvalidBuildPathsError`, `JsonSchemaValidationError`, `FrameworkPlaceholderInPluginError`, `InvalidSourceMarketplaceError` | Throw from `domain/errors.ts`. | Spec requires verbatim names. |

---

## 4. Risks + mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | Registry refactor changes copilot/codex output (breaks AC #3). | Medium | High | Phase 1 golden snapshot byte-identity gate before any new strategy. |
| R-2 | `synthesizeClaudeStyleManifest` extraction drifts the Copilot manifest body. | Medium | High | Phase 2 golden + helper unit tests; copilot path switched and snapshot-gated in the same commit. |
| R-3 | Implementer reuses Copilot `rewriteJsonFile` for claude/cursor hooks → `${CLAUDE_PLUGIN_ROOT}` break. | Medium | High | D-6 explicit; integration SHA-256 byte-equality gate (AC #1) fails loudly. |
| R-4 | Cursor agent emits `tools`/`color` (lazy reuse of copilot strip). | Medium | High | D-3 dedicated allowlist + integration assertion (AC #2). |
| R-5 | `claude-code-plugin-manifest.json` (`additionalProperties:false`) rejects a synthesized field. | Low | Medium | D-7 verify in Phase 3; relax schema or synthesis on loud ajv failure. |
| R-6 | Golden normalization leaks machine-dependent values (abs paths / path hashes). | Medium | High | Phase 5 follows `golden-machine-independence.md`; two-capture byte-identity gate. |
| R-7 | `FrameworkBuildTarget` widening triggers exhaustiveness errors elsewhere. | Low | Low | Surfaced at typecheck in Phase 1; fixed same phase. |
| R-8 | Class rename breaks test imports / mocks. | Low | Low | D-12 updates tests in the rename commit; typecheck gate. |
| R-9 | D-9 codex marketplace-builder extraction drifts codex output. | Low | Medium | Codex golden gate; D-9 fallback = leave codex private builder, duplicate ≤15-LOC builder for claude+cursor. |
| R-10 | Cursor marketplace schema actually diverges from claude (D-2 wrong). | Low | Medium | Integration re-validation; reversal trigger adds `cursor-marketplace` key — localized follow-up, non-blocking. |

---

## 5. Validation commands

```bash
# All phases
pnpm biome check --write
pnpm typecheck

# Phase 1
pnpm vitest run tests/golden/golden-baseline.e2e.test.ts        # copilot/codex byte-identical (AC #3)
pnpm vitest run tests/e2e/framework-build.e2e.test.ts
pnpm vitest run tests/application/use-cases/framework/

# Phase 2
pnpm vitest run tests/domain/formats/agent-frontmatter-strip.unit.test.ts
pnpm vitest run tests/application/use-cases/framework/marketplace-strategy-helpers.unit.test.ts
pnpm vitest run tests/golden/golden-baseline.e2e.test.ts        # still byte-identical

# Phase 3
pnpm vitest run tests/application/use-cases/framework/claude-output-strategy.integration.test.ts

# Phase 4
pnpm vitest run tests/application/use-cases/framework/cursor-output-strategy.integration.test.ts

# Phase 5
pnpm vitest run tests/golden/golden-baseline.e2e.test.ts        # 4-target matrix
pnpm vitest run tests/e2e/framework-build.e2e.test.ts
pnpm vitest run                                                 # full suite

# Smoke (manual, /tmp only — never repo root)
pnpm build
node dist/cli.js framework build --source tests/fixtures/framework-real --target claude --out /tmp/dist-claude
node dist/cli.js framework build --source tests/fixtures/framework-real --target cursor --out /tmp/dist-cursor
ls /tmp/dist-claude/.claude-plugin/marketplace.json /tmp/dist-claude/plugins/*/.claude-plugin/plugin.json
ls /tmp/dist-cursor/.cursor-plugin/marketplace.json /tmp/dist-cursor/plugins/*/.cursor-plugin/plugin.json
```

---

## 6. Spec AC coverage matrix

| Spec AC # | Covered by phase | Test gate |
|---|---|---|
| 1 (claude tree shape + schema) | Phase 3 | `claude-output-strategy.integration.test.ts` tree + schema re-validation |
| 2 (cursor tree shape + no `tools`/`color`) | Phase 4 | `cursor-output-strategy.integration.test.ts` frontmatter assertion |
| 3 (copilot/codex byte-identical) | Phase 1, Phase 2 | Golden snapshot byte-identity (gated each refactor) |
| 4 (idempotent re-run) | Phase 3, Phase 4 | Two-run byte-identity in integration tests |
| 5 (unknown target/pair → error path) | Phase 1, Phase 3, Phase 4 | Unknown-key error assertion + `InvalidBuildPathsError` |
| 6 (`commands/`/`rules/` warn-skip) | Phase 3, Phase 4 | Warn capture + absence assertion |
| 7 (`synthesizeClaudeStyleManifest` presence-conditional fields) | Phase 2 | Helper unit-test permutations |
| 8 (golden machine-independent matrix) | Phase 5 | Golden two-capture byte-identity + stored baseline |
| 9 (smoke `/tmp`) | Phase 5 | Manual gate, documented smoke file |

---

## 7. Out-of-scope (deferred)

- OpenCode target + flat mode for claude/cursor/codex (D-14, D-15) — flat phase.
- Cursor `.mdc` rules + commands emitters (D-16).
- Codex / Copilot rework (validated, spec §"Validated — no rework").
- MCP source authoring (framework ships none; `writeMcp` no-op for current inputs).
- Cursor-specific marketplace/manifest schema files (D-2, D-7) — added only on a verified required-key divergence.
