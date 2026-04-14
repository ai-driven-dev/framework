# Code Review for Granular MCP Selection — Refactor (#259)

Post-refactor review following PR feedback. Domain logic extracted from use-cases into `mcp.ts` pure functions and a shared `McpUseCase`. 28 files changed, 4 new test files, 29 new tests.

- Status: Needs minor fixes
- Confidence: 8/10

---

- [Main expected Changes](#main-expected-changes)
- [Scoring](#scoring)
- [Code Quality Checklist](#code-quality-checklist)
- [Final Review](#final-review)

## Main expected Changes

- [x] `mcp.ts` — 4 pure domain functions extracted (`extractMcpKeys`, `filterMcpExclusions`, `computeMcpExclusions`, `detectNewMcpEntries`)
- [x] `McpUseCase` — shared use-case with 3-branch selection (flag / interactive / default-all)
- [x] `install-use-case.ts` — MCP block replaced by domain calls + `McpUseCase`
- [x] `update-use-case.ts` — duplicate `detectNewMcpEntries` / `filterOneFile` / `removeExcludedKeys` removed
- [x] `uninstall-use-case.ts` — `mcpFilter` made non-optional (`string[]`)
- [x] Unit tests for 4 domain functions (`mcp.unit.test.ts`)
- [x] Integration tests for `McpUseCase` (`mcp-use-case.integration.test.ts`)

## Scoring

### Potentially Unnecessary Elements

- [🟢] No dead code introduced

### Standards Compliance

- [🟢] Naming conventions followed (`mcp` prefix used consistently)
- [🟢] Import style correct (type imports, `.js` extensions)
- [🟡] **Non-exported interface**: `mcp-use-case.ts` — `McpOptions` interface is not exported. Callers constructing `execute()` input cannot type their variable explicitly without a local redefinition. Export it.

### Architecture

- [🟢] Hexagonal layers respected — `mcp.ts` domain functions have no infrastructure imports
- [🟢] `McpUseCase` lives in `shared/` and is never called from commands directly
- [🟢] Commands are thin wrappers — `mcpFilter: cmdOptions.mcp?.split(",").map(...) ?? []`
- [🟢] Prior `parseEntryKeys` and `removeKeysFromJsonFile` duplications resolved

### Code Health

- [🔴] **Method size limit**: `install-use-case.ts:159` `installOneTool` has ~34 code lines (limit: ≤20). The `generateDistribution` call alone spans 10 physical lines. Extract MCP selection steps into `private async applyMcpSelection(generated, config, ...) : Promise<{ exclusions, filtered }>`.
- [🔴] **Method size limit**: `update-use-case.ts:444` `applyMcpExclusions` has 21 code lines (1 over limit). `detectNewMcpEntries` and `filterMcpExclusions` multi-line calls add up. Extract the exclusion-detection + prompt block into a private `resolveNewExclusions(...)` method.
- [🔴] **Method size limit**: `uninstall-use-case.ts:133` `removeMcpFromTool` has ~22 code lines (limit: ≤20). The nested `for` loops with inner `for` push count. Extract per-file key-removal into a private `removeFileKeys(mergeFile, ...)` method.

### Security

- [🟢] No security concerns (CLI tool, no network surface)

### Error management

- [🟢] `McpUseCase` throws `InputRequiredError` for unknown filter keys
- [🟢] JSON parse failures are safely guarded in domain functions

### Performance

- [🟢] No performance concerns

### Backend specific

#### Logging

- [🟢] Logging unchanged — no regressions

## Final Review

- **Score**: 8/10
- **Feedback**: The domain extraction is clean and well-tested. The `McpUseCase` pattern is correct. The remaining violations are all method size, not architecture.
- **Follow-up Actions**:
  1. `install-use-case.ts:installOneTool` — extract `applyMcpSelection(generated, configHandler, lookup, mcpFilter, interactive)` private method (returns `{ exclusions, filtered }`)
  2. `update-use-case.ts:applyMcpExclusions` — extract `resolveNewExclusions(toolId, manifest, newDistribution, configHandler, lookup, interactive)` private method
  3. `uninstall-use-case.ts:removeMcpFromTool` — extract `removeFileKeys(mergeFile, projectRoot, mcpFilter)` private method
  4. `mcp-use-case.ts` — export `McpOptions` interface
- **Additional Notes**: 1023 tests passing, typecheck clean, lint clean. jscpd reports 26 clones (7 new, all structural — import blocks and parameter pass-through patterns, not logic duplication).
