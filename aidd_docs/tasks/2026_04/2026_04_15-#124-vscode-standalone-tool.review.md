# Code Review for feat(tools): vscode as standalone IDE tool (#124)

Separates VS Code config from copilot tool — new `vscode` ToolConfig (config-only), `PerKeyMergeStrategy` for per-key merge, copilot cleanup, and manifest v1→v2 migration.

- Status: APPROVED with minor notes
- Confidence: 8.5/10

---

- [Main expected Changes](#main-expected-changes)
- [Scoring](#scoring)
- [Code Quality Checklist](#code-quality-checklist)

## Main expected Changes

- [x] `PerKeyMergeStrategy` type + `isPerKeyMergeStrategy` guard in `merge-strategy.ts`
- [x] `mergeJsonFile` per-key logic in `file-system-adapter.ts`
- [x] `vscode` added to `ToolId` / `VALID_TOOL_IDS` in `tool-config.ts`
- [x] `signalDir: string | null` on `ToolConfig` interface + null guard in `hasToolSignals`
- [x] New `src/domain/tools/vscode.ts` with config-only ToolConfig
- [x] Copilot cleanup: removed `vscodeExtensions`, `vscodeKeybindings`, `vscodeSettings` from `copilot.ts`
- [x] `deps.ts` import for `vscode.ts`
- [x] Manifest v1→v2 migration: `MANIFEST_VERSION` bump + `migrateV1toV2()`
- [x] `buildTrackedSet` fix in `status-use-case.ts` for cross-tool directory overlap
- [x] Unit + integration tests covering all new behaviors

## Scoring

- [🟡] **Vacuous test assertions** `tests/domain/tools/vscode.unit.test.ts:43-61` — Two `describe` blocks use `if (isPerKeyMergeStrategy(strategy)) { expect(...) }` without an unconditional assertion before the guard. If `isPerKeyMergeStrategy` returns false (regression), the inner `expect` calls silently pass vacuously, giving false confidence. (Replace `if` block with unconditional `expect(isPerKeyMergeStrategy(strategy)).toBe(true)` then proceed directly)
- [🟡] **Null handlers: near-identical code in 3 constants** `src/domain/tools/vscode.ts:31-65` — `NULL_SECTION_HANDLER`, `NULL_COMMANDS_HANDLER`, `NULL_RULES_HANDLER` share the same `convertFrontmatter`/`reverseConvertFrontmatter` body returning `{}`. While they implement different interfaces (and a single shared object isn't possible), a shared `nullFrontmatter` mixin constant could replace the duplicated body across the 3 declarations (DRY rule — ≥2 callers share identical logic).
- [🟡] **Implicit return type on `mergeStrategy`** `src/domain/tools/vscode.ts:105` — `mergeStrategy(configName: string)` has no explicit return type annotation. TypeScript infers it via structural compatibility with `ConfigHandler`, but the explicit `: MergeStrategy` annotation is preferred per project typing conventions.
- [🟢] **Architecture**: domain files import only from `domain/` — no infra or application imports introduced
- [🟢] **Method sizes**: all methods ≤ 20 lines; `buildTrackedSet` at 15 lines, `mergePerKey` at 13 lines
- [🟢] **Import style**: `.js` extensions on all relative imports, `import type` used for type-only imports
- [🟢] **Constants**: `COPILOT_CRITICAL_KEYS`, `VSCODE_SETTINGS_STRATEGY`, `VSCODE_MIGRATION_PATHS` properly named and reused
- [🟢] **Migration design**: `migrateV1toV2` is a pure standalone function, mutates the raw data before parse — clean separation from the `Manifest` class internals
- [🟢] **`buildTrackedSet` naming**: method name is descriptive and intent is clear; the cross-tool directory overlap fix is correct and doesn't regress existing behavior
- [🟢] **`hasToolSignals` null guard**: `if (!config.signalDir) return []` placed before any `join` call — fail-fast, no null propagation risk
- [🟢] **Tests**: 8 migration unit tests cover all edge cases (files migrated, no-op variants, v0 throws, v2 loads clean); per-key integration tests cover framework-prime win, user-prime win, and absent-key insertion

## Code Quality Checklist

### Potentially Unnecessary Elements

- [🟢] No dead code, no stubs, no placeholder throws
- [🟢] `NULL_COMMANDS_HANDLER.convertFrontmatter` correctly omits the second `relativeFileName` param (TypeScript allows fewer params than the interface signature requires — intentional)

### Standards Compliance

- [🟢] Naming conventions followed: `vscodeToolConfig`, `COPILOT_CRITICAL_KEYS`, `migrateV1toV2`, `mergePerKey`
- [🟢] File naming: `vscode.ts`, `vscode.unit.test.ts`, `merge-strategy.unit.test.ts`
- [🟢] Named exports only — no `export default`

### Architecture

- [🟢] Domain → Application → Infrastructure direction maintained
- [🟢] `vscode.ts` imports only from `../models/` (domain layer only)
- [🟢] `mergePerKey` extracted as module-level private function — correct placement alongside `deepMerge`
- [🟡] `buildTrackedSet` in `status-use-case.ts` receives `manifest` as a parameter even though the use-case likely holds it as a field. Consistent with existing patterns in the file, but worth checking if `manifest` is already a field to avoid redundant parameter passing.

### Code Health

- [🟢] No magic strings: all config names referenced via `CONFIG_VSCODE_*` constants
- [🟢] No magic numbers
- [🟡] `if (raw.version === MANIFEST_VERSION - 1)` — arithmetic on a constant is acceptable but a named `PREVIOUS_MANIFEST_VERSION` constant would be more explicit and easier to update when chaining migrations

### Security

- [🟢] No new attack surfaces — JSON merge operates on already-parsed data
- [🟢] No user input reaches `mergePerKey` without prior JSON parse validation

### Error management

- [🟢] `mergeJsonFile` preserves existing `ENOENT` handling — missing file treated as empty object, all other errors rethrown via `JsonParseError`
- [🟢] `migrateV1toV2` is defensive: early returns on missing `tools`, missing `copilot`, empty vscode file list
- [🟢] `ManifestValidationError` still thrown for any version other than current or current-1

### Performance

- [🟢] `mergePerKey` iterates keys once — O(n) where n = top-level keys
- [🟢] `VSCODE_MIGRATION_PATHS` is a `Set` — O(1) lookup during migration filter

## Final Review

- **Score**: 8.5/10
- **Feedback**: Clean implementation. Architecture and domain isolation are respected. The three issues flagged are minor: vacuous test guards, duplicated null handler bodies, and missing explicit return type. None are blocking.
- **Follow-up Actions**:
  1. Fix vacuous `if` guards in `vscode.unit.test.ts` to use unconditional `expect` + type narrowing
  2. Extract `nullFrontmatter` mixin to eliminate body duplication across `NULL_*_HANDLER` constants
  3. Add explicit `: MergeStrategy` return type to `mergeStrategy()` in `vscode.ts`
- **Additional Notes**: The `MANIFEST_VERSION - 1` pattern works but should be revisited when #123 lands and v2→v3 migration is needed — ensure chained migrations are supported before merging that PR.
