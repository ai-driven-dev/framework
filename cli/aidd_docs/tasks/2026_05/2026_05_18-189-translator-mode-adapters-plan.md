---
plan_id: 189-translator-mode-adapters
objective: Refactor implicit Mode A/B translator branching into explicit named adapter classes (ModeAMarketplaceAdapter, ModeBFlatMaterializationAdapter), with each AI tool's preferred mode declared via the existing PluginsCapability.mode field.
success_condition: "pnpm test && pnpm typecheck && pnpm knip:production"
iteration: 0
created_at: 2026-05-18
acceptance_criteria:
  - ModeAMarketplaceAdapter class exists, documents and encapsulates Mode A contract (marketplace registration in tool's config file via marketplaceSettings)
  - ModeBFlatMaterializationAdapter class exists, documents and encapsulates Mode B contract (flat file materialization on disk via PluginTranslator)
  - Claude, Copilot, Codex use ModeAMarketplaceAdapter (PluginsCapability.mode === "native" AND marketplaceSettings != null)
  - OpenCode uses ModeBFlatMaterializationAdapter (PluginsCapability.mode === "flat")
  - Zero behavioral change — all 1399 tests pass
  - Each adapter class has JSDoc documenting its mode contract
  - Each adapter file has a *.unit.test.ts asserting it implements its expected contract
---

## Architecture decision

### Where do the adapters live?

`src/application/use-cases/plugin/translator/`

Rationale (from project rules):

1. `infrastructure/adapters/` is ruled out. Rule `6-adapter.md` defines adapters as "port implementations, I/O translation only, no business logic." The Mode A and Mode B classes orchestrate domain operations (reading ManifestRepository, writing files via FileWriter, merging JSON, calling PluginTranslator). They have business logic and are not port implementations. Placing them in `infrastructure/` would violate the rule.

2. `domain/` is ruled out. Rule `0-hexagonal.md` states domain must not import from application or infrastructure. The adapters need I/O ports (FileReader, FileWriter, Hasher, ManifestRepository), which are application-layer dependencies.

3. `src/application/use-cases/plugin/translator/` follows the established sub-use-case pattern from rule `6-capability-sub-use-cases.md`: "matching sub-use-case receives a narrowed type; sub-use-cases live in subdirs: `install/`, `update/`." The `translator/` subdir mirrors this pattern as a sibling to the existing `plugin/` directory. The classes serve the `PluginAddUseCase` and `MarketplaceSyncSettingsUseCase` orchestrators.

### Naming decision

Class names use `*Adapter` suffix per AC literal requirement: `ModeAMarketplaceAdapter`, `ModeBFlatMaterializationAdapter`. File names follow kebab-case: `mode-a-marketplace-adapter.ts`, `mode-b-flat-materialization-adapter.ts`.

Rule `6-adapter.md` has frontmatter `paths: src/infrastructure/adapters/**/*.ts` — it is scoped to that directory and does NOT govern classes in `application/use-cases/plugin/translator/`. Placing these classes outside `infrastructure/adapters/` is therefore compliant with the rule. JSDoc on each class clarifies: "This class is a translator strategy, not a hexagonal port adapter."

The GoF Strategy pattern is the correct conceptual pattern for these classes, but the `*Adapter` suffix is used for AC traceability and product-level naming alignment with the roadmap dual-mode translator vocabulary.

### Mode declaration

`PluginsCapability.mode` (values: `"native"` | `"flat"` | `"unsupported"`) already discriminates modes. A new `translationMode` field would duplicate this. The plan uses the existing field as the authoritative declaration:

- `mode === "native"` AND `marketplaceSettings != null` → **Mode A** (Claude, Copilot, Codex, Cursor)
- `mode === "flat"` → **Mode B** (OpenCode)
- `mode === "native"` AND `marketplaceSettings === null` → neutral native (no marketplace sync, no flat; use-case skips)
- `mode === "unsupported"` → tool has no plugin capability at all

Note on Cursor: Cursor currently uses `mode: "native"` with `marketplaceSettings` present (forward-compat entry). The acceptance criteria only name Claude/Copilot/Codex as Mode A and OpenCode as Mode B. Cursor's current capability declaration routes it through Mode A logic (same as Claude/Copilot/Codex) — this is NOT changed by this issue. Cursor's Mode B migration is a separate issue (13d/13g).

### All implicit branching sites to refactor

The current implicit Mode A/B branches are:

1. `MarketplaceSyncSettingsUseCase.syncTool` — checks `caps.plugins?.marketplaceSettings == null` to gate Mode A sync. This entire use-case IS the Mode A logic. Delegate from `ModeAMarketplaceAdapter`.

2. `PluginAddUseCase.isFlatTool` — private method that checks `plugins.mode === "flat"`. Used as discriminant in `addGithubMarketplacePlugin` to split toolIds into flat vs native cohorts.

3. `PluginAddUseCase.addGithubMarketplacePlugin` — routes `flatToolIds` → `addLocalPlugin` (Mode B path) and `nativeToolIds` → `registerNativeGithubPlugins` (Mode A path).

4. `PluginAddUseCase.addPluginForTool` — the `!this.isFlatTool(toolId)` branch gates local marketplace registration (Mode A behavior).

5. `PluginTranslator.translateWithComponentPaths` — branches on `mode === "native"` vs `mode === "flat"`. This is domain-pure and currently the cleanest of all branching sites. The refactor decision for this site: **leave in place**. `PluginTranslator` is a domain model (`src/domain/models/`), it is pure (no I/O), and the branch is a direct capability dispatch — it does not need a strategy class wrapper. The strategies in `translator/` will call `PluginTranslator` as a collaborator.

---

## Phases

### Phase 1: Define the translator adapter contract

Goal: establish the interface that both adapters implement, without changing any behavior.

Files touched:
- NEW `src/application/use-cases/plugin/translator/plugin-translation-adapter.ts` — defines `PluginTranslationAdapter` interface with JSDoc; discriminant type `PluginTranslationMode = "marketplace" | "flat"`

Acceptance:
- `PluginTranslationAdapter` interface has `readonly mode: PluginTranslationMode` and at least `addPlugin(...)` method matching the existing `addPluginForTool` behavior contract
- No existing file is modified
- `pnpm test` still passes (no behavior changed)

### Phase 2: Extract ModeAMarketplaceAdapter and factory

Goal: extract the Mode A logic from `PluginAddUseCase` and `MarketplaceSyncSettingsUseCase` into `ModeAMarketplaceAdapter`, wire the factory, and update both callers.

`MarketplaceSyncSettingsUseCase` is large and already IS the Mode A logic. Rather than re-extracting all its private methods into `ModeAMarketplaceAdapter`, the adapter exposes the Mode A contract surface (JSDoc + interface implementation + `mode: "marketplace"` discriminant) and delegates to `MarketplaceSyncSettingsUseCase` as its internal collaborator. This satisfies AC #1 ("implements Mode A contract") without unnecessary duplication.

Files touched:
- NEW `src/application/use-cases/plugin/translator/mode-a-marketplace-adapter.ts`
  - Class `ModeAMarketplaceAdapter` implementing `PluginTranslationAdapter`
  - JSDoc: "Mode A — Marketplace + plugins. This class is a translator adapter (not a hexagonal port adapter). Registers the framework marketplace in the tool's native config file (extraKnownMarketplaces / enabledPlugins) using MarketplaceSettings. Used by tools with native marketplace support: Claude, Copilot VSCode, Codex, Cursor."
  - `readonly mode = "marketplace" as const`
  - Delegates marketplace registration to injected `MarketplaceSyncSettingsUseCase`
  - Owns the native path from `PluginAddUseCase.addGithubMarketplacePlugin` (registerNativeGithubPlugins logic)
  - All methods ≤ 20 lines
- NEW `src/application/use-cases/plugin/translator/plugin-translation-adapter-factory.ts`
  - Pure factory function `resolveTranslationAdapter(pluginsCapability, deps): PluginTranslationAdapter | null`
  - Returns `ModeAMarketplaceAdapter` when `mode === "native"` AND `marketplaceSettings != null`
  - Returns `ModeBFlatMaterializationAdapter` when `mode === "flat"` (placeholder until Phase 3; can return null for flat in Phase 2)
  - Returns `null` for `"unsupported"` or `"native"` without `marketplaceSettings`
- MODIFY `src/application/use-cases/plugin/plugin-add-use-case.ts` — delegate Mode A path via factory; keep `isFlatTool` for now (removed in Phase 3)
- MODIFY `src/application/use-cases/marketplace/marketplace-sync-settings-use-case.ts` — route through `ModeAMarketplaceAdapter`

Acceptance:
- `ModeAMarketplaceAdapter` class exists with JSDoc and `mode: "marketplace"`
- Factory exists and routes correctly for Mode A case
- `pnpm test` passes (all 1399 tests green)
- `pnpm typecheck` passes

### Phase 3: Extract ModeBFlatMaterializationAdapter

Goal: extract the Mode B logic (flat plugin materialization) from `PluginAddUseCase` into `ModeBFlatMaterializationAdapter`, complete the factory, and remove the now-redundant `isFlatTool` private method.

Files touched:
- NEW `src/application/use-cases/plugin/translator/mode-b-flat-materialization-adapter.ts`
  - Class `ModeBFlatMaterializationAdapter` implementing `PluginTranslationAdapter`
  - JSDoc: "Mode B — Flat materialization. This class is a translator adapter (not a hexagonal port adapter). Materializes plugin content directly into the tool's plugin directory as files on disk. Used by tools without native marketplace support: OpenCode."
  - `readonly mode = "flat" as const`
  - Contains logic extracted from `PluginAddUseCase.addLocalPlugin` (flat branch) and `PluginAddUseCase.addPluginForTool` (flat path)
  - All methods ≤ 20 lines
- MODIFY `src/application/use-cases/plugin/translator/plugin-translation-adapter-factory.ts`
  - Complete the factory: return `ModeBFlatMaterializationAdapter` for `mode === "flat"` (was placeholder in Phase 2)
- MODIFY `src/application/use-cases/plugin/plugin-add-use-case.ts`
  - Delegate Mode B path to `ModeBFlatMaterializationAdapter` via factory
  - Remove `isFlatTool` private method (routing now handled by factory via `PluginsCapability.mode`)
  - `addGithubMarketplacePlugin` splits toolIds using the factory result

Acceptance:
- `ModeBFlatMaterializationAdapter` class exists with JSDoc and `mode: "flat"`
- `isFlatTool` private method removed from `PluginAddUseCase`
- Factory fully resolves both modes
- `pnpm test` passes (all 1399 tests green)
- `pnpm typecheck` passes

### Phase 4: Consolidate routing — remove residual inline mode checks

Goal: verify no stray `mode === "flat"` or `mode === "native"` string comparisons remain outside the factory in the two caller use-cases. This phase is cleanup verification after Phases 2–3.

Files touched (audit and fix only):
- REVIEW `src/application/use-cases/plugin/plugin-add-use-case.ts` — no inline mode string checks remain; all routing via factory
- REVIEW `src/application/use-cases/marketplace/marketplace-sync-settings-use-case.ts` — no inline mode string checks remain; routed via `ModeAMarketplaceAdapter`
- FIX any stragglers found during review

Acceptance:
- `pnpm knip:production` passes (no unreferenced exports from new `translator/` files)
- No inline `"flat"` / `"native"` mode string comparisons outside `plugin-translation-adapter-factory.ts`
- `pnpm test` passes (all 1399 tests green)
- `pnpm typecheck` passes

### Phase 5: Add unit tests per adapter

Goal: add per-adapter unit test files asserting each adapter implements its expected contract, per `5-test-pyramid.md` ("unit tests: domain models, pure functions; mock all ports via in-memory implementations").

Files touched:
- NEW `tests/application/use-cases/plugin/translator/mode-a-marketplace-adapter.unit.test.ts`
  - describe blocks per behavior (following `feedback_test_naming.md` memory rule)
  - Covers: Mode A registration writes to correct settings file; skips tools with `marketplaceSettings == null`; handles empty marketplace list; handles already-present marketplace entry (idempotent)
  - Uses in-memory port implementations from `tests/helpers/ports/`
- NEW `tests/application/use-cases/plugin/translator/mode-b-flat-materialization-adapter.unit.test.ts`
  - Covers: Mode B materialization writes plugin files to correct flat directory; handles empty plugin distribution; handles multiple tools
  - Uses in-memory port implementations from `tests/helpers/ports/`
- NEW `tests/application/use-cases/plugin/translator/plugin-translation-adapter-factory.unit.test.ts`
  - Covers: factory returns `ModeAMarketplaceAdapter` for native + marketplaceSettings; factory returns `ModeBFlatMaterializationAdapter` for flat; factory returns null for unsupported

Acceptance:
- `pnpm test` passes (1399 + new tests green)
- Zero new test skips
- Each test file uses `describe` blocks, not "ClassName — behavior" prefixes in test names

---

## Rules table

| Rule | Source | Why it applies |
|---|---|---|
| Adapters implement ports, no business logic | `.claude/rules/06-design-patterns/6-adapter.md` | Confirms translator adapters must NOT live in `infrastructure/adapters/`; rule is scoped to that path |
| Sub-use-cases live in subdirs | `.claude/rules/06-design-patterns/6-capability-sub-use-cases.md` | Establishes `translator/` subdir pattern |
| Every method ≤ 20 lines | `.claude/rules/06-design-patterns/6-method-size.md` | All new adapter methods must comply |
| Domain never imports app/infra | `.claude/rules/00-architecture/0-hexagonal.md` | Adapters cannot live in domain; they need I/O ports |
| Class with `*UseCase` suffix for orchestrators | `.claude/rules/06-design-patterns/6-use-case.md` | Translator adapters are NOT use-cases (no `execute()` with `*Options` / `*Result`); `*Adapter` suffix is per AC and compliant because `6-adapter.md` is scoped to `infrastructure/adapters/` |
| Named exports only, no default exports | `.claude/rules/01-standards/1-exports.md` | All new classes exported as named exports |
| `*.unit.test.ts` for pure function tests | `.claude/rules/05-testing/5-test-pyramid.md` | Adapters get unit tests; use in-memory ports |
| Mock only ports, not implementations | `.claude/rules/05-testing/5-test-pyramid.md` | In-memory implementations from `tests/helpers/ports/` |
| Use describe blocks for grouping | `memory/feedback_test_naming.md` | No "ClassName — behavior" prefixes; use nested `describe` |
| Relative imports with `.js` extension | `.claude/rules/02-programming-languages/2-typescript.md` | All imports in new files must follow this |
| No `any` type | `.claude/rules/02-programming-languages/2-typescript.md` | Explicit types or generics in adapter signatures |
| Single responsibility per class | `.claude/rules/07-quality/7-clean-code.md` | `ModeAMarketplaceAdapter` handles only Mode A; `ModeBFlatMaterializationAdapter` handles only Mode B |

---

## Risks

1. **`PluginTranslator` scope creep.** `PluginTranslator` is a domain model with its own Mode A/B branching (`mode === "native"` vs `mode === "flat"`). The refactor plan explicitly leaves `PluginTranslator` untouched. It lives in `domain/models/`, is I/O-free, and its branching is a pure capability dispatch. Pulling adapters into domain would violate `0-hexagonal.md`. Scope boundary: adapters in `application/`, translator stays in `domain/`.

2. **Cursor's ambiguous mode.** Cursor uses `mode: "native"` with `marketplaceSettings` present — the same as Mode A tools. The factory will correctly route Cursor through `ModeAMarketplaceAdapter`. This is intentional (AC #3/#4 names only Claude/Copilot/Codex/OpenCode, but Cursor's current behavior is unchanged). Cursor's Mode B migration is a separate issue and must NOT be done in this issue.

3. **`MarketplaceSyncSettingsUseCase` delegation model.** This use-case IS the Mode A logic in full. `ModeAMarketplaceAdapter` owns the Mode A contract surface (JSDoc + `mode: "marketplace"` discriminant + `PluginTranslationAdapter` interface) and delegates to `MarketplaceSyncSettingsUseCase` as its internal collaborator. Do NOT re-extract `syncToolSettings`, `mergeMarketplacesArray`, etc. into the adapter — that duplicates code rather than extracting it. The goal is named routing and documented contracts, not code relocation.

4. **Constructor injection order.** Rule `6-use-case.md` specifies injection order: `FileSystem → Repository → Loader → Hasher → Logger → Platform → Prompter`. New adapter constructors must follow the same order for codebase consistency.

5. **Test helper gaps.** New tests may require in-memory port implementations that do not yet exist in `tests/helpers/ports/`. If any are missing, add them in Phase 5 before writing the tests. Do not use real filesystem in unit tests.

6. **knip false positives.** Adding new files to `src/application/use-cases/plugin/translator/` may surface knip warnings if no top-level use-case imports them yet. Verify `pnpm knip:production` passes after Phase 4 wiring.

---

## Test plan

### Unit tests (new — Phase 5)

- `tests/application/use-cases/plugin/translator/mode-a-marketplace-adapter.unit.test.ts`
  - describe "when tool has marketplaceSettings" → registers marketplace entry in settings file
  - describe "when tool has no marketplaceSettings" → skips sync, returns false
  - describe "when marketplace is already registered" → idempotent, no write
  - describe "when marketplace list is empty" → skips, returns false
- `tests/application/use-cases/plugin/translator/mode-b-flat-materialization-adapter.unit.test.ts`
  - describe "when tool is flat mode" → materializes plugin files in correct output directory
  - describe "when plugin distribution is empty" → writes no files
  - describe "when multiple tools are in flat mode" → materializes independently per tool
- `tests/application/use-cases/plugin/translator/plugin-translation-adapter-factory.unit.test.ts`
  - describe "resolveTranslationAdapter" → returns ModeAMarketplaceAdapter for native + marketplaceSettings
  - describe "resolveTranslationAdapter" → returns ModeBFlatMaterializationAdapter for flat
  - describe "resolveTranslationAdapter" → returns null for unsupported

### Regression

- `pnpm test` after each phase — must remain at 1399 passing, 0 skip throughout
- `pnpm typecheck` after each phase
- `pnpm knip:production` after Phase 4 (wiring phase)
- No new test skips introduced

### Existing tests that cover the refactored paths (must remain green)

- `tests/application/use-cases/plugin/plugin-add-use-case.unit.test.ts` — covers `PluginAddUseCase` including flat/native routing
- `tests/application/use-cases/marketplace/marketplace-add-use-case.unit.test.ts` — covers Mode A registration flow
- `tests/application/use-cases/sync/` — covers sync use-cases that trigger `MarketplaceSyncSettingsUseCase`
- E2E suite — full CLI journeys covering install/sync for all tools
