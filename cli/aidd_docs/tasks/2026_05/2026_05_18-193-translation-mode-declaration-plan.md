---
plan_id: 193-translation-mode-declaration
objective: Add explicit `translationMode` field to `PluginsCapability` as the single declaration point for the Mode A/B routing decision, replacing the current two-field derivation in the factory.
success_condition: "pnpm test && pnpm typecheck && pnpm knip:production && pnpm lint"
iteration: 0
created_at: 2026-05-18
acceptance_criteria:
  - Tool definition includes `translationMode: "marketplace" | "flat"` field (via PluginsCapability — the capability is part of the tool definition)
  - All existing tool definitions updated with correct mode (claude/copilot/codex/cursor → "marketplace"; opencode → "flat")
  - Factory reads `translationMode` directly instead of deriving from `mode` + `marketplaceSettings`
  - Docs updated: JSDoc on `PluginsCapability` documents the new field and replaces derivation comment in factory
chosen_option: 3
chosen_option_rationale: >
  Option 3 — refactor: add `translationMode` to `PluginsCapability` (not top-level `AiTool<C>`).
  This honors #189's no-duplication principle while satisfying #193's AC#1 (explicit declaration).
  The capability IS the per-tool declaration site for plugin routing; `AiTool<C>` itself has no
  plugin concept without `HasPlugins`, so a nullable top-level field would be weaker.
  The factory's current two-field derivation (`mode === "native" && marketplaceSettings != null`)
  is implicit routing that an explicit field eliminates cleanly.
  Option 1 (add field on top of existing derivation) creates two parallel sources of truth and
  must be rejected. Option 2 (close as superseded) loses the roadmap 13e traceability and
  leaves the factory's two-field derivation untouched.
---

## Decision

### Why not Option 1

Option 1 adds `translationMode` to `AiTool<C>` as a new field alongside the existing
`PluginsCapability.mode` derivation. This creates two parallel sources of truth: the factory
continues reading `plugins.mode + marketplaceSettings`, and tool declarations gain a field
that would either be ignored or shadow the factory logic. Any future maintainer must keep
both in sync. This is strictly worse than the status quo. Rejected.

### Why not Option 2

Issue #189's plan explicitly deferred explicit declaration to a follow-up:
> "A new `translationMode` field would duplicate this. The plan uses the existing field
> as the authoritative declaration." (plan section: Mode declaration)

But #189 is about naming the adapters; #193 is about removing the implicit two-field
derivation in the factory. The roadmap issue 13e ("feat: tool capability declaration of
preferred mode") is still open. Closing #193 as superseded leaves that roadmap entry
unresolved and keeps the implicit `mode === "native" && marketplaceSettings !== null`
branch in the factory. Rejected.

### Why Option 3 — and where to place the field

`PluginsCapability` is the correct placement, not `AiTool<C>` top-level, for three reasons:

1. **Single-concept cohesion.** `translationMode` is a plugin-routing concern. It belongs
   in the same capability class that holds `mode`, `marketplaceSettings`, `pluginsDir`, etc.
   Placing it on `AiTool<C>` would require checking `"plugins" in tool.capabilities` before
   every access — adding a guard that doesn't exist on any other tool-level field.

2. **AC#1 is satisfied by capability.** In this codebase, the "tool definition" is the
   object literal in `src/domain/tools/ai/*.ts`, which composes capabilities. `PluginsCapability`
   is declared inside that definition. AC#1 says "Tool definition interface includes
   `translationMode`" — the capability interface is part of the tool definition.

3. **Eliminates the factory derivation.** The factory currently reads two fields to derive
   one decision: `plugins.mode === "native" && plugins.marketplaceSettings !== null`. Adding
   `translationMode` to `PluginsCapability` makes the factory read a single field. No double
   source of truth, no derivation logic.

### What changes and what stays

`PluginsCapability.mode` (`"native" | "flat" | "unsupported"`) is NOT removed. It is used
by `plugin-translator.ts` for a different concern (detecting flat collision paths), and by
the capability constructor's own branching logic. It remains as-is.

`translationMode: PluginTranslationMode | null` is added to `PluginsCapability`:
- `"marketplace"` for native + marketplaceSettings (Claude, Copilot, Codex, Cursor)
- `"flat"` for flat (OpenCode)
- `null` for native-without-marketplace and unsupported (no translation strategy applies)

The domain type `PluginTranslationMode` already exists at
`src/domain/models/plugin-translation-mode.ts` (added by #189). No new type needed.

The factory body simplifies from two-field derivation to a single null-check:
```ts
if (plugins.translationMode === "marketplace") return new ModeAMarketplaceAdapter();
if (plugins.translationMode === "flat") return new ModeBFlatMaterializationAdapter(deps.fs, deps.hasher);
return null;
```

---

## Phases

### Phase 1: Add `translationMode` to `PluginsCapability`

Goal: add the field to the capability class and all construction params, without changing
the factory or any caller. All tool declarations must explicitly pass the value.

Files touched:
- MODIFY `src/domain/capabilities/plugins-capability.ts`
  - Add `readonly translationMode: PluginTranslationMode | null` to the class
  - Add `translationMode?: PluginTranslationMode` (optional with default) to `NativePluginsParams`
    → present when `marketplaceSettings != null`; absent (defaults to `null`) for neutral native
  - For `FlatPluginsParams`: set to `"flat"` automatically (no caller input needed — flat always = Mode B)
  - For `UnsupportedPluginsParams`: set to `null`
  - Constructor assigns the field from params with appropriate defaults per mode
  - Update JSDoc on the class and the new field
  - Import `PluginTranslationMode` from `domain/models/plugin-translation-mode.js`
- MODIFY `src/domain/tools/ai/claude.ts` — add `translationMode: "marketplace"` to plugins params
- MODIFY `src/domain/tools/ai/codex.ts` — add `translationMode: "marketplace"` to plugins params
- MODIFY `src/domain/tools/ai/cursor.ts` — add `translationMode: "marketplace"` to plugins params
- MODIFY `src/domain/tools/ai/copilot.ts` — add `translationMode: "marketplace"` to plugins params
- (opencode.ts needs no change — flat mode auto-sets `"flat"`)

Acceptance:
- `PluginsCapability` has `translationMode` with correct value for each tool
- `pnpm typecheck` passes
- `pnpm test` still passes (no behavior changed yet)

### Phase 2: Update the factory to read `translationMode`

Goal: replace the two-field derivation in `resolveTranslationAdapter` with direct field read.

Files touched:
- MODIFY `src/application/use-cases/plugin/translator/plugin-translation-adapter-factory.ts`
  - Replace `plugins.mode === "native" && plugins.marketplaceSettings !== null` check with `plugins.translationMode === "marketplace"`
  - Replace `plugins.mode === "flat"` check with `plugins.translationMode === "flat"`
  - Update the JSDoc comment block to reflect the new routing logic
  - Remove references to `marketplaceSettings` from the routing comment

Acceptance:
- Factory reads only `translationMode`, no more two-field derivation
- `pnpm test` passes
- `pnpm typecheck` passes

### Phase 3: Update tests and JSDoc (docs AC)

Goal: update existing test file for the factory and capability to assert on `translationMode`;
verify no test is silently relying on the old derivation path.

Files touched:
- MODIFY `tests/application/use-cases/plugin/translator/plugin-translation-adapter-factory.unit.test.ts`
  - Update describe blocks to use `translationMode: "marketplace"` / `"flat"` in test capability construction
  - Ensure the `mode: "unsupported"` test case still asserts `null` return (no change in behavior)
- MODIFY `tests/domain/capabilities/plugins-capability.unit.test.ts`
  - Add assertions that `cap.translationMode` equals expected value for each mode variant
  - Cover: native+marketplaceSettings → `"marketplace"`, flat → `"flat"`, native-no-marketplace → `null`, unsupported → `null`
- REVIEW `src/domain/capabilities/plugins-capability.ts` JSDoc — ensure field description is complete

Acceptance:
- All tests pass (1414+ green)
- JSDoc on `translationMode` is self-contained (does not require reading factory to understand)
- `pnpm knip:production` passes

---

## Rules table

| Rule | Source | Why it applies |
|---|---|---|
| Named exports only | `.claude/rules/01-standards/1-exports.md` | `PluginTranslationMode` already named-exported from domain model; capability class stays named export |
| `readonly` on fields | `.claude/rules/02-programming-languages/2-typescript.md` | `translationMode` must be `readonly` |
| No `any` type | `.claude/rules/02-programming-languages/2-typescript.md` | Use `PluginTranslationMode \| null` explicitly |
| Domain never imports app/infra | `.claude/rules/00-architecture/0-hexagonal.md` | `PluginTranslationMode` lives in `domain/models/` — safe to import from capability |
| Discriminant types in domain/models/ | `.claude/rules/08-domain/8-value-objects.md` | `PluginTranslationMode` already correctly placed; no new inline union needed |
| Methods ≤ 20 lines | `.claude/rules/06-design-patterns/6-method-size.md` | `PluginsCapability` constructor must stay ≤ 20 lines; extract helper if needed |
| Relative imports with `.js` extension | `.claude/rules/02-programming-languages/2-typescript.md` | Import `PluginTranslationMode` with `.js` extension |
| Use describe blocks in tests | `memory/feedback_test_naming.md` | Test blocks for `translationMode` assertions use describe groups |
| Value objects: all fields readonly | `.claude/rules/08-domain/8-value-objects.md` | `translationMode` is readonly, set in constructor |

---

## Risks

1. **`NativePluginsParams` interface change is non-breaking only if `translationMode` is optional.**
   Tool declarations that don't pass `translationMode` will default to `null` (neutral native).
   All 4 Mode A tools (claude, copilot, codex, cursor) MUST explicitly pass `"marketplace"` in
   Phase 1. If any are missed, the factory will silently return `null` for that tool — breaking
   marketplace sync. Guard: Phase 1 acceptance check includes `pnpm test` which covers marketplace
   sync use-cases for all tools.

2. **`plugin-translator.ts` uses `plugins.mode !== "flat"` for collision detection.**
   This is a different concern (capability format for path generation, not routing strategy).
   `PluginsCapability.mode` is NOT changed. `plugin-translator.ts` must NOT be migrated to
   `translationMode` in this issue — collision detection is about the storage format, not the
   install strategy. Risk of confusion: add a comment in `plugin-translator.ts` at the call
   site noting the semantic distinction.

3. **`PluginsCapability` constructor size.**
   The constructor is already branching across 3 modes. Adding one more assignment per branch
   should stay within the 20-line limit, but must be verified. If it exceeds 20 lines, extract
   a private static `resolveTranslationMode(params: PluginsParams): PluginTranslationMode | null`
   helper — 3 lines in constructor, logic isolated.

4. **`"unsupported"` value exercised in tests.**
   Two test files construct `new PluginsCapability({ mode: "unsupported" })`. Adding
   `translationMode` to `UnsupportedPluginsParams` as automatically-null is safe — no API
   change for these callers. Verify in Phase 3 that these tests still compile without changes.

5. **Cursor's forward-compat `marketplaceSettings`.**
   Cursor has `marketplaceSettings` and is currently routed through `ModeAMarketplaceAdapter`.
   Explicitly setting `translationMode: "marketplace"` on its `PluginsCapability` in Phase 1
   preserves this behavior. No behavioral change for Cursor. The future Cursor Mode B migration
   (issue 13d/13g) will change this field, not add a new derivation.

---

## Test plan

### Existing tests — must remain green (regression)

- `tests/domain/capabilities/plugins-capability.unit.test.ts` — will be extended in Phase 3
- `tests/application/use-cases/plugin/translator/plugin-translation-adapter-factory.unit.test.ts` — will be updated in Phase 3
- All plugin-add, marketplace-sync, and e2e suite tests — must stay green through all phases
- `pnpm test` after each phase; count must not drop below 1414

### Phase 3 additions (capability assertions)

describe `PluginsCapability — translationMode`:
  - "native with marketplaceSettings" → `translationMode === "marketplace"`
  - "native without marketplaceSettings" → `translationMode === null`
  - "flat" → `translationMode === "flat"`
  - "unsupported" → `translationMode === null`

describe `resolveTranslationAdapter`:
  - "translationMode marketplace" → returns `ModeAMarketplaceAdapter` (previously: checked via `mode + marketplaceSettings`)
  - "translationMode flat" → returns `ModeBFlatMaterializationAdapter`
  - "translationMode null" → returns null

### Validation gates

- `pnpm typecheck` after Phase 1 (field addition)
- `pnpm test` after Phase 2 (factory switch)
- `pnpm knip:production` after Phase 3 (no dead exports)
- `pnpm lint` after Phase 3 (biome clean)
