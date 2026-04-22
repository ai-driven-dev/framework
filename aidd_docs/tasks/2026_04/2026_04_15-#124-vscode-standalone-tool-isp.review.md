---
name: code-review
description: Code review for #124 vscode standalone tool — ISP refactor (AiToolConfig/IdeToolConfig split)
argument-hint: N/A
---

# Code Review for #124 — VSCode as Standalone Tool (ISP Refactor)

Full ISP refactor: ToolConfig split into AiToolConfig (AI tools) and IdeToolConfig (IDE-only tools). vscode extracted from copilot, manifest migrated to v2, PerKeyMergeStrategy added.

- Status: Approved with minor notes
- Confidence: High

---

- [Main expected Changes](#main-expected-changes)
- [Scoring](#scoring)
- [Code Quality Checklist](#code-quality-checklist)
- [Final Review](#final-review)

## Main expected Changes

- [x] `ToolConfig` renamed to `AiToolConfig`, new `IdeToolConfig` minimal interface added
- [x] `AnyToolConfig` union + `isAiToolConfig()` type guard
- [x] `AI_TOOL_IDS` constant extracted (TOOL_SUFFIXES now uses it, not VALID_TOOL_IDS)
- [x] `vscode.ts` simplified to ~45 lines implementing `IdeToolConfig` only
- [x] `generateConfigDistribution()` added for config-only tools (no docsDir, no sections)
- [x] `isAiToolConfig` guards in adopt / install / restore / update use-cases
- [x] `sync-use-case.ts` throws for IDE source tool, silently skips IDE target tool
- [x] `PerKeyMergeStrategy` added to `merge-strategy.ts` with `isPerKeyMergeStrategy()` guard
- [x] `mergePerKey()` in `file-system-adapter.ts` applies per-key logic
- [x] `MANIFEST_VERSION` bumped to 2, `migrateV1toV2()` moves vscode files out of copilot
- [x] `buildTrackedSet()` in status-use-case prevents cross-tool false-positive drift detection
- [x] All tests updated and passing (1036 tests)

## Scoring

- [🟢] **ISP compliance**: `IdeToolConfig` has exactly 4 fields — toolId, directory, signalDir, config(). Zero dead methods.
- [🟢] **Type guard**: `isAiToolConfig` uses `"agents" in config` — correct structural check, not instanceof
- [🟢] **AI_TOOL_IDS vs VALID_TOOL_IDS**: `TOOL_SUFFIXES` correctly uses `AI_TOOL_IDS` — vscode does not produce `.vscode.md` suffixed files
- [🟢] **generateConfigDistribution**: proper separation — no docsDir, no section handlers, no acceptsFile filtering
- [🟡] **manifest.ts:migrateV1toV2** `migrateV1toV2(raw: Record<string, unknown>)` mutates the raw object in place before parsing. Works, but is a side-effectful function on unvalidated data. Low risk here, but a `returns new Record` pattern would be safer and more explicit. (minor)
- [🟡] **file-system-adapter.ts:mergePerKey** `mergePerKey` does key-by-key scalar replacement (no deep merge). If a config key has an object value (e.g. nested JSON object), the whole value is overwritten rather than deep-merged. This is probably intentional for settings.json, but not documented. (minor — add a comment)
- [🟢] **VSCODE_MIGRATION_PATHS**: named constant Set, not inline literals
- [🟢] **COPILOT_CRITICAL_KEYS**: extracted as named const above the config object
- [🟢] **buildTrackedSet in status-use-case**: correctly prevents vscode files in `.vscode/` from appearing as "added" in the copilot status check
- [🟢] **sync-use-case guards**: source IDE tool throws `InputRequiredError` (user-visible), target IDE tool returns `{ files: [] }` (silent skip) — correct asymmetry
- [🟢] **hasToolSignals null guard**: `if (!config.signalDir) return []` added before path join — correct
- [🟢] **Registry type**: `Map<ToolId, AnyToolConfig>` — open for future IDE tools without interface changes
- [🟢] **vscode.ts**: no null handlers, no stub methods — YAGNI respected
- [🟡] **manifest.ts:migrateV1toV2** Migration only handles the `copilot → vscode` path. If a user has a v1 manifest where vscode files were never under copilot (e.g. manually initialized), migration silently no-ops. This is correct behavior but could cause confusion if `tools.vscode` already exists with different content — the spread `[...existing, ...vscodeFiles]` would duplicate entries. Low probability in practice. (minor)
- [🟢] **No barrel files**: all imports go directly to source files

## Code Quality Checklist

### Potentially Unnecessary Elements

- [🟢] No stub/placeholder methods left in vscode.ts
- [🟢] No dead code introduced

### Standards Compliance

- [🟢] Naming conventions: `AiToolConfig`, `IdeToolConfig`, `AnyToolConfig`, `isAiToolConfig`, `AI_TOOL_IDS` — all correct casing
- [🟢] `import type` used for type-only imports throughout
- [🟢] Named exports only, no defaults

### Architecture

- [🟢] Hexagonal layers respected: `IdeToolConfig` and `AiToolConfig` live in `domain/models/`, `vscode.ts` in `domain/tools/`
- [🟢] Use-cases never contain tool-specific logic — guards delegate to domain type system
- [🟢] `generateConfigDistribution` in domain model, not in use-case
- [🟡] `generateConfigDistribution` duplicates the `resolveOutput` async closure pattern from `generateDistribution`. If a third function needed the same pattern, extraction would be warranted. Acceptable at 2 callers. (low priority)

### Code Health

- [🟢] `vscode.ts` ~45 lines — well within file size bounds
- [🟢] All private methods in status-use-case and sync-use-case remain under 20 lines
- [🟢] `mergePerKey` is a pure function (no I/O, no side effects)
- [🟢] No magic strings in `mergePerKey` or `migrateV1toV2`

### Security

- [🟢] No new attack surface introduced
- [🟢] JSON merge logic handles missing keys without crashing

### Error Management

- [🟢] `getToolConfig()` still throws `ToolValidationError` on unregistered tool
- [🟢] Sync source guard throws `InputRequiredError` (user sees a clear message)
- [🟢] Migration errors would propagate through existing `ManifestValidationError` chain

### Performance

- [🟢] `buildTrackedSet` iterates all installed tools — acceptable given the small number of tools

### Backend Specific

#### Logging

- [🟢] No regressions in logger usage

## Final Review

- **Score**: 9/10
- **Feedback**: Clean ISP refactor. The separation between `AiToolConfig` and `IdeToolConfig` is precise and leaves no dead methods in either interface. The migration path is safe for the expected production case. The two minor issues (in-place mutation in `migrateV1toV2` and undocumented shallow-merge behavior in `mergePerKey`) are low-risk and do not require immediate action.
- **Follow-up Actions**:
  - Add a comment in `mergePerKey` clarifying that per-key replacement is intentionally shallow (no deep merge).
  - Consider guarding duplicate vscode files in `migrateV1toV2` (deduplicate by `relativePath` after spread).
- **Additional Notes**: `generateConfigDistribution` correctly handles the config-only distribution path without dragging in docsDir or section filtering. The `VSCODE_SETTINGS_STRATEGY` per-key approach is a pragmatic solution that correctly preserves user customizations while enforcing Copilot-critical keys.
