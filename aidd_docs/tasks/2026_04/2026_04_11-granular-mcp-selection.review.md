# Code Review for Granular MCP Server Selection (#259)

7 source files changed, 1 new file, 4 test files updated. 1149 insertions, 56 deletions.

- Status: Needs fixes
- Confidence: 7/10

---

- [Main expected Changes](#main-expected-changes)
- [Scoring](#scoring)
- [Code Quality Checklist](#code-quality-checklist)

## Main expected Changes

- [x] McpExclusion domain type
- [x] Manifest excludedMcp tracking (add/get/remove/clear + serialization)
- [x] Install MCP selection (--mcp flag + interactive checkbox + backward compat)
- [x] Uninstall selective MCP removal (--mcp flag + surgical JSON key removal)
- [x] Update exclusion-aware merge handling
- [x] Unit + integration tests (23 new tests)

## Scoring

### Potentially Unnecessary Elements

- [🟢] No unnecessary elements detected

### Standards Compliance

- [🟢] Naming conventions followed
- [🟢] Coding rules ok
- [🟢] Import style correct (type imports, .js extensions)

### Architecture

- [🟢] Hexagonal layers respected (domain has no infra imports)
- [🟢] Commands are thin wrappers
- [🟢] Use-cases own prompter calls
- [🔴] **Method size limit**: `update-use-case.ts:399` `applyToolUpdate` is ~41 code lines (limit is 20). Was already 32 lines pre-feature but grew further. Must extract MCP exclusion steps into a named private method.
- [🟡] **Manifest rebuild hack**: `uninstall-use-case.ts:204` `rebuildMergeEntries` removes and re-adds the tool via `removeTool()` + `addTool()` with dummy `GeneratedFile` objects (empty content). This works because `addTool` only uses `relativePath`, `hash`, and `frameworkPath` from the files. But it's fragile — if `addTool` ever uses `content` or `mergeStrategy`, this breaks silently. Consider adding a `updateToolMergeFiles(toolId, mergeFiles, excludedMcp)` method to `Manifest` instead.

### Code Health

- [🔴] **Duplication**: `parseEntryKeys` in `install-use-case.ts:320` and `parseEntryKeysFromContent` in `update-use-case.ts:749` are identical. Extract to a shared function in `merge-entry.ts` (domain model).
- [🔴] **Duplication**: `removeKeysFromJsonFile` in `uninstall-use-case.ts:187` and `update-use-case.ts:652` are identical. Both use `this.fs.readFile` + JSON parse + delete keys + `this.fs.writeFile`. Consider adding a `removeJsonKeys(path, sectionKey, keys)` method to the `FileSystem` port, or extract to a shared use-case helper.
- [🟡] **Similar filtering logic**: `filterMergeFileContent` in `install-use-case.ts:387` and `removeExcludedKeys` in `update-use-case.ts:818` both parse JSON, filter section keys, and create a new `GeneratedFile`. The logic is inverted (include vs. exclude) but structurally similar. Acceptable duplication — different intent.

### Security

- [🟢] No security concerns (CLI tool, no user-facing network surface)

### Error management

- [🟢] Throws on invalid mcpFilter keys with clear error message
- [🟢] Throws for uninstalled tools
- [🟢] JSON parse failures silently return empty/unchanged (defensive, appropriate for config files)

### Performance

- [🟢] No performance concerns

## Final Review

- **Score**: 7/10
- **Feedback**: Feature is complete and well-tested, but has 2 concrete duplication issues and 1 method size violation that should be fixed before merge.
- **Follow-up Actions**:
  1. Fix `applyToolUpdate` method size — extract MCP exclusion resolution and filtering into a private method (e.g. `applyMcpExclusions`)
  2. Extract `parseEntryKeys(content, sectionKey)` to `merge-entry.ts` as a shared domain function
  3. Extract `removeKeysFromJsonFile` to eliminate duplication between uninstall and update use cases
  4. Consider replacing the `rebuildMergeEntries` hack with a dedicated `Manifest.updateToolMergeFiles()` method
- **Additional Notes**: 987 tests passing, typecheck clean, lint clean, knip clean, jscpd shows 19 clones (all pre-existing). The feature is functionally correct.
