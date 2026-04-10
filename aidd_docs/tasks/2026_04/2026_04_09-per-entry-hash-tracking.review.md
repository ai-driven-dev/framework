---
name: code-review
description: Code review checklist and scoring template
argument-hint: N/A
---

# Code Review for Per-entry hash tracking (#123)

Per-entry hash tracking for merge config files (`.mcp.json`, `.vscode/settings.json`, etc.), enabling precise drift detection, conflict resolution, and safe auto-removal at the entry level instead of the whole-file level.

- Statuts: PASS (all issues fixed)
- Confidence: 9/10

---

- [Main expected Changes](#main-expected-changes)
- [Scoring](#scoring)
- [Code Quality Checklist](#code-quality-checklist)

## Main expected Changes

- [x] New `MergeFileEntry` domain model and `extractMergeEntries` pure function
- [x] `ConfigHandler.entrySection()` in all 4 tool configs
- [x] Manifest v2 with `mergeFiles` field and v1 migration
- [x] Install computes per-entry hashes and stores in `mergeFiles`
- [x] Status detects per-entry drift (modified/deleted entries)
- [x] Update computes per-entry diff and surgically removes dropped entries
- [x] Uninstall/clean/restore properly handle merge files

## Scoring

### Fixed during review

- [🟢] **Repeated file I/O**: `update-use-case.ts:517` `isEntryUserModified` read disk file N times for N dropped entries in same merge file (refactored to `readDiskEntries` called once in `findDroppedEntries`)
- [🟢] **Missing error handling**: `merge-entry.ts:18` `JSON.parse` threw unhandled `SyntaxError` on malformed disk JSON (wrapped in try/catch, returns empty map)
- [🟢] **Code duplication**: `install-use-case.ts:264` and `update-use-case.ts:598` had identical 10-line methods for building merge entries (extracted `buildMergeFileEntries` and `buildConfigNameLookup` to `merge-entry.ts`)

### Accepted trade-offs

- [🟡] **Optional hasher in StatusUseCase**: `status-use-case.ts:46` `hasher?: Hasher` is optional for backward compatibility. Per-entry drift detection silently skipped when not provided. Both command callers now pass it. Acceptable because this avoids a breaking change in the constructor, and internal callers (like restore command's status check) also pass it.
- [🟡] **Uninstall deletes entire merge file**: `uninstall-use-case.ts:63` If user added custom MCP servers, uninstall deletes the whole file including user entries. Same behavior as v1 (merge files were in `files` array). Surgical entry removal during uninstall was out of scope per the plan.
- [🟡] **v1 migration sets sectionKey to null**: `manifest.ts:825` Migrated merge files have `sectionKey: null` and empty entries. Per-entry drift detection won't work until next install populates correct section keys. Documented in plan.

## Code Quality Checklist

### Potentially Unnecessary Elements

- [🟢] No unnecessary elements found

### Standards Compliance

- [🟢] Naming conventions followed (kebab-case files, camelCase functions, PascalCase types)
- [🟢] ESM imports with `.js` extension throughout
- [🟢] `import type` used for type-only imports
- [🟢] Coding rules ok

### Architecture

- [🟢] 3-layer architecture respected: domain model in `domain/models/merge-entry.ts`, use-cases in `application/use-cases/`, tool configs in `domain/tools/`
- [🟢] Domain layer has zero infrastructure imports (verified: `merge-entry.ts` imports only from domain ports and domain models)
- [🟢] Port interface extended cleanly (`ConfigHandler.entrySection`)
- [🟢] Proper separation of concerns: extraction logic in domain, orchestration in use-cases

### Code Health

- [🟢] All methods under 20-line limit (largest: `resolveEntryRemovals` at 14 lines)
- [🟢] No magic numbers/strings (constants used for merge file paths, section keys from tool configs)
- [🟢] Cyclomatic complexity acceptable
- [🟢] Error handling for JSON parsing added

### Security

- [🟢] No SQL injection risks (N/A)
- [🟢] No XSS vulnerabilities (N/A)
- [🟢] No data exposure points

### Error management

- [🟢] `extractMergeEntries` handles malformed JSON gracefully (returns empty map)
- [🟢] Null/missing section keys handled (falls back to top-level extraction)
- [🟢] File-not-found cases handled in status and update (returns empty/deleted)

### Performance

- [🟢] Disk file read once per merge file in `findDroppedEntries` (was N times, fixed)
- [🟡] `extractNewEntries` in update scans the full distribution array with `.find()` per manifest entry. For typical installs (1-3 merge files per tool), this is negligible.

### Frontend specific

- N/A (CLI project)

### Backend specific

#### Logging

- [🟢] Logging via existing `Logger` port (no new log points needed for per-entry operations)

## Final Review

- **Score**: 9/10
- **Feedback**: Clean implementation with well-decomposed methods. The shared `buildMergeFileEntries` extraction eliminated code duplication between install and update. The v1 migration is simple and safe. The per-entry diff and surgical removal in update is the most complex part but is well-structured with clear separation of diff computation, conflict resolution, and application.
- **Follow-up Actions**: None blocking. The 3 yellow items (optional hasher, uninstall behavior, v1 migration sectionKey) are acceptable trade-offs documented in the plan.
- **Additional Notes**: 963 tests passing, 23 new tests added (10 unit + 13 integration). jscpd duplication at 2.1% (down from 2.26% after extraction). All static checks pass.
