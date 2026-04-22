---
name: code-review
description: Code review checklist and scoring template
argument-hint: N/A
---

# Code Review for feat/124-vscode-standalone-tool-part-2 (#143 PR cleanup)

Covers VSCode standalone tool separation, AI/IDE category filter, typed errors, uninstall merge-file bug fix, and IDE warning message improvements.

- Status: APPROVED with minor follow-ups
- Confidence: High

---

- [Main expected Changes](#main-expected-changes)
- [Scoring](#scoring)
- [Code Quality Checklist](#code-quality-checklist)
- [Final Review](#final-review)

## Main expected Changes

- [x] VSCode tool split: `vscode` as standalone `IdeToolConfig`, files moved from `copilot`
- [x] `kind: "ai" | "ide"` discriminant on `AiToolConfig` / `IdeToolConfig`
- [x] `AiToolId` / `IdeToolId` / `ToolCategory` types + `toolIdsForCategory` exhaustive switch
- [x] `--ai` / `--ide` / `--all` flags on `setup`, `install`, `uninstall`, `status`, `doctor`
- [x] `parseCategoryArg` centralized in `global-options.ts`
- [x] Typed errors (Phase 2): `InvalidToolIdError`, `CategoryMismatchError`, `UnregisteredToolError`, etc.
- [x] `migrateV1toV2` — moves vscode files out of `copilot` entry
- [x] `generateForConfig` — unified dispatcher replacing dual-call pattern
- [x] `IdePatchUseCase` deleted, inlined into `installOneTool`
- [x] Bug B fix: merge files with non-null `sectionKey` stripped (not raw-deleted) on uninstall
- [x] IDE warning message: explicit about MCP/Chat/extensions + correct `aidd install ide` command

## Scoring

- [🔴] **Method size** `uninstall-use-case.ts:120`: `removeMergeFile` is 31 code lines, exceeds the 20-line hard limit. Should be split into `resolveDeletePermission(toolId, allToolIds, relativePath, manifest)` + `deleteOrStripMergeFile(mergeEntry, fullPath, canDelete)`.

- [🟡] **DRY — category parsing** `uninstall.ts:25-26` and `install.ts` (inside `resolveInstallArgs:22`): the ternary `rawArgs[0] === "ai" || rawArgs[0] === "ide" ? rawArgs[0] : undefined` is inlined twice instead of calling a shared helper. `parseCategoryArg` is not reused here because it exits on invalid values — but a pure `detectCategoryPrefix(rawArgs)` helper would centralize the detection without the exit semantics.

- [🟡] **DRY — empty-check logic duplicated** `clean-use-case.ts:107` and `uninstall-use-case.ts:156`: `isEffectivelyEmpty` vs `isMergeFileEffectivelyEmpty` are two private methods with overlapping responsibility. The uninstall version is a strict superset (handles `sectionKey`). Should be extracted to `src/domain/models/merge-entry.ts` as a pure function `isMergeContentEmpty(content, sectionKey)`.

- [🟡] **Architecture — business guard in command** `uninstall.ts:75`: `throw new NoToolsInstalledError(category)` is thrown inside the command action (interactive branch), not from the use-case. The rule states business decisions belong in use-cases. This is inside a `try/catch` so it's handled, but the guard logic (filtering candidates, asserting non-empty) belongs in `UninstallUseCase`.

- [🟡] **Dead export** `distribution.ts:111`: `generateConfigDistribution` is exported but has no external callers — only called internally by `generateForConfig`. Should be unexported (`async function generateConfigDistribution`) to narrow the public API surface.

- [🟢] **`resolveToolIds` in `setup.ts`** `setup.ts:11-34`: module-level helper calls `errorHandler.handle(e)` + returns `null` to short-circuit. Mixes command-layer error handling inside a pure helper. Acceptable given the command thin-wrapper constraint, but the `null` sentinel is fragile — a boolean `hasError` flag or explicit early `process.exit(1)` would be cleaner.

## Code Quality Checklist

### Potentially Unnecessary Elements

- [x] `generateConfigDistribution` exported but unused externally → dead export (see scoring)
- [x] `ToolValidationError` removed ✓, `ConfigConflictError` removed ✓, `PackageManagerError` replaced ✓

### Standards Compliance

- [x] Naming conventions: `AiToolId`, `IdeToolId`, `ToolCategory` — correct PascalCase/camelCase
- [x] `.js` extension on all relative imports ✓
- [x] `import type` for type-only imports ✓
- [x] `CONSTANT_CASE` for `VSCODE_MIGRATION_PATHS`, `AI_TOOL_IDS`, `IDE_TOOL_IDS` ✓

### Architecture

- [x] `kind` discriminant on `ToolConfig` — correct, replaces duck-typing `"agents" in config`
- [x] `isAiToolConfig` uses `config.kind === "ai"` ✓
- [x] `toolIdsForCategory` uses exhaustive `switch` with `default: throw` on `never` ✓
- [x] `migrateV1toV2` in domain model (`manifest.ts`) not leaking to application layer ✓
- [x] `VSCODE_MIGRATION_PATHS` constant with inline rationale comment ✓
- [ ] `removeMergeFile` > 20 lines — violates method size rule

### Code Health

- [x] No magic strings: `"servers"`, `".vscode/mcp.json"` etc. localized in tool config ✓
- [x] Guard clauses used throughout (early returns) ✓
- [ ] `isEffectivelyEmpty` / `isMergeFileEffectivelyEmpty` — duplication across use-cases
- [x] Typed errors with messages built internally ✓

### Security

- [x] No new I/O paths exposed without `fileExists` guard ✓
- [x] No new user-facing string interpolation risks ✓

### Error management

- [x] All new errors extend `Error`, set `this.name` ✓
- [x] `ManifestValidationError` replaced by specific typed errors in all manifest methods ✓
- [ ] `NoToolsInstalledError` thrown in command layer (should originate from use-case)

### Performance

- [x] `collectMergeFilePaths` builds a `Set` once, O(1) lookup in loop ✓
- [x] `computeSharedPaths` unchanged, still correct ✓

## Final Review

- **Score**: 7.5/10
- **Feedback**: The core feature (VSCode standalone tool, category filter, migration, bug B fix) is solid. The discriminant type approach is correct and the typed errors are a clear improvement. Three medium issues stand out: `removeMergeFile` exceeds the 20-line hard limit and should be refactored; the empty-check logic is duplicated between `clean-use-case` and `uninstall-use-case` and belongs in the domain; and `NoToolsInstalledError` is thrown from the command layer. The dead export on `generateConfigDistribution` is a minor API surface issue.
- **Follow-up Actions**:
  1. Split `removeMergeFile` into two private methods (method size rule)
  2. Extract `isMergeContentEmpty(content, sectionKey)` to `merge-entry.ts`
  3. Move `NoToolsInstalledError` throw + candidate-filtering into `UninstallUseCase`
  4. Unexport `generateConfigDistribution`
- **Additional Notes**: Migration v1→v2 is correct and tested. The `VSCODE_MIGRATION_PATHS` constant with its "do not remove" comment is the right pattern. The IDE warning message (`copilot IDE settings (MCP servers, Chat, extensions) require vscode`) is clear and actionable.
