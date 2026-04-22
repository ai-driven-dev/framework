---
name: code-review
description: Code review for IDE context patch on install feature
argument-hint: N/A
---

# Code Review for IDE context patch on install

Feature adds: VSCode as standalone IDE tool type, IDE-conditional config distribution (copilot's `.vscode/settings.json`), `IdePatchUseCase` for patching already-installed AI configs when IDE is added later, and uninstall fix preserving user-prime IDE files.

- Status: CHANGES REQUIRED
- Confidence: HIGH

---

- [Main expected Changes](#main-expected-changes)
- [Scoring](#scoring)
- [Code Quality Checklist](#code-quality-checklist)

## Main expected Changes

- [x] `IdeToolConfig` / `AiToolConfig` split — `isAiToolConfig()` discriminant
- [x] `requiredIdeIds` on `AiToolConfig`; copilot declares `["vscode"]`
- [x] `IdePatchUseCase` distributes IDE-conditional files when IDE installed after AI tool
- [x] Uninstall fix: IDE tool merge files (user-prime) never deleted
- [x] `filterGeneratedFilesByIdeContext` — IDE-conditional file distribution
- [x] All 1054 tests pass

## Scoring

- [🔴] **Method size — installOneTool**: `install-use-case.ts:235` — body is ~62 code lines, 3× over the 20-line limit. This method now handles: tool-already-installed guard, config retrieval, distribution generation (AI vs IDE ternary), stale file removal, IDE context filtering, MCP server selection, force-rewrite of excluded MCP keys, file writing, conflict warnings, merge entry building, and manifest update. (extract `generateToolDistribution()`, `applyIdeAndMcpFilters()`, `recordInstallation()` private methods)

- [🔴] **Method size — installAllTools**: `install-use-case.ts:121` — body is 31 code lines, over the 20-line limit. This PR added the IdePatchUseCase block (lines 29-43), which pushed it over the limit. (extract `patchAlreadyInstalledAiTools(toolIds, manifest, ...)` private method containing the `newIdeIds` filter and `IdePatchUseCase.execute()` call)

- [🟡] **Method size — clearExcludedMcpKeys**: `install-use-case.ts:344` — body is 22 code lines, 2 over the limit. Marginal but violates the rule. (extract the inner per-file block starting at `if (file.mergeStrategy === "none")` into `clearExcludedMcpKeysForFile(file, exclusions, configHandler, lookup, projectRoot)`)

- [🟡] **Naming — isIdeTool**: `uninstall-use-case.ts:141` — `const isIdeTool = !isAiToolConfig(getToolConfig(toolId))` is a double negative. Any non-AI config is treated as IDE but the domain has only two types today; the guard would silently pass for future third types. (rename to `const skipFileDeletion = !isAiToolConfig(getToolConfig(toolId))` or add explicit `isIdeToolConfig` guard in `tool-config.ts`)

## Code Quality Checklist

### Potentially Unnecessary Elements

- [🟢] `uninstall-use-case.ts:155` — `new Set([toolId, ...allToolIds])`: `toolId` is always contained in `allToolIds` (the caller passes it as one of the IDs being uninstalled), so the explicit spread is redundant. Low risk but noisy.

### Standards Compliance

- [🟢] Naming conventions followed
- [🟢] Coding rules ok (biome, typecheck, knip all pass)

### Architecture

- [🔴] **Design patterns — method size**: see Scoring above; 2 confirmed violations in `install-use-case.ts`, 1 marginal
- [🟢] Proper separation of concerns — `IdePatchUseCase` correctly in `shared/`, never called from commands, uses `execute(options)` pattern
- [🟢] Domain layer clean — `tool-config.ts`, `config-ref-filter.ts`, `merge-entry.ts` contain no application/infrastructure imports
- [🟢] `isAiToolConfig` discriminant pattern is correct and avoids storing `mergeStrategy` in the manifest

### Code Health

- [🔴] `installOneTool` size (see above)
- [🔴] `installAllTools` size (see above)
- [🟡] `clearExcludedMcpKeys` size (see above)
- [🟢] No magic strings or numbers
- [🟢] Error handling: use-cases throw, commands catch — pattern respected

### Security

- [🟢] No SQL / XSS / injection risks
- [🟢] No secrets or env variable leakage

### Error management

- [🟢] No silent errors; all failures propagate to command-level `errorHandler`

### Performance

- [🟢] No unnecessary I/O loops introduced

### Backend specific

#### Logging

- [🟢] `this.logger.info()` calls present at appropriate points

## Final Review

- **Score**: 7/10 — feature logic is correct and well-tested, architecture violations are limited to method size in `install-use-case.ts`
- **Feedback**: The three method size violations (`installOneTool`, `installAllTools`, `clearExcludedMcpKeys`) are the only actionable issues. `installOneTool` is the most critical at ~62 lines — it accumulated complexity across multiple PRs and the refactor is overdue. The two new commits in this PR pushed both `installAllTools` and `installOneTool` past their limits. The `IdePatchUseCase` design itself (`requiredIdeIds` on the tool config, no mergeStrategy in manifest, discriminant for uninstall) is clean and correct.
- **Follow-up Actions**:
  1. Extract private methods from `installOneTool` to bring it under 20 lines
  2. Extract `patchAlreadyInstalledAiTools()` from `installAllTools`
  3. Consider `clearExcludedMcpKeysForFile()` extraction from `clearExcludedMcpKeys`
- **Additional Notes**: Tests are comprehensive — unit, integration, and E2E all pass (1054 total). The uninstall regression test (`preserves settings.json when vscode is the only owner`) and the two IDE patch integration tests provide good coverage of the new paths.
