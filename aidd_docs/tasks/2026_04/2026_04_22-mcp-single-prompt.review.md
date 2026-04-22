# Code Review for fix/142-mcp-single-prompt

Fix MCP prompt firing once per tool during install/update. Aggregate MCP entries across all tools, prompt once, delegate prompt logic to shared `McpUseCase`.

- Status: ✅ Approved with minor fixes
- Confidence: 8/10

---

## Main expected Changes

- [x] `McpUseCase` — validate-only → prompt-capable shared use case
- [x] `install-use-case.ts` — two-phase loop: prepare all → prompt once → apply
- [x] `update-use-case.ts` — two-phase loop: prepare all → prompt once → apply
- [x] Tests updated for single-prompt assertion

## Scoring

- [🟡] **DRY** `install-use-case.ts:248` `getToolConfig(toolId)` called again inside `installOneToolFromData` — already computed in `prepareToolInstall`, result stored in `ToolInstallData.configHandler`. The full `config` object (needed for `checkForceWarning` + `appendMissingIdeWarnings`) should be stored in `ToolInstallData` to avoid a second call.
- [🟡] **Dead WHY comment** `update-use-case.ts` around line 205 — comment explaining why `executeInternal` runs even when no changes detected ("bump manifest version so update banner doesn't report this version as outdated") was deleted. Non-obvious invariant — must be restored.
- [🟡] **Dead WHY comment** `update-use-case.ts` around line 943 — comment "User keeps their modified version on disk as an untracked file. Excluded from the new manifest automatically." also deleted. Non-obvious behaviour — must be restored.
- [🟡] **Line too long** `update-use-case.ts:417` — `return { toolId, version, newDistribution, newDistMap, diff, entryDiffs, configHandler, configRefs, newMcpEntries, manifestFiles };` exceeds 120 chars. Split to multiline object.
- [🟢] **Architecture** — `McpUseCase` correctly centralises prompt, install and update delegate cleanly. No business logic leaks into commands.
- [🟢] **Method sizes** — all methods within 20-line limit.
- [🟢] **Separation of concerns** — prepare phase (pure detection), prompt phase (single call), apply phase (side effects) cleanly separated in both use cases.
- [🟢] **Tests** — 8 branches covered in `mcp-use-case` tests. Multi-tool deduplication asserted in both install and update.
- [🟢] **Non-null assertion** — correctly replaced `this.prompter!` with early return guard.
- [🟢] **`defaultChecked` semantics** — `false` for install (opt-in), `true` for update (opt-out), non-interactive default is consistent.

## Code Quality Checklist

### Potentially Unnecessary Elements

- [🟢] No dead code introduced

### Standards Compliance

- [🟢] Naming conventions followed
- [🟡] One line exceeds 120 chars (`prepareToolUpdate` return)

### Architecture

- [🟢] Hexagonal layers respected — prompt logic in use case, not command
- [🟢] `McpUseCase` correctly placed in `shared/`

### Code Health

- [🟡] `getToolConfig` called twice per tool in install (prepare + apply)
- [🟢] No magic strings — prompt messages defined at call site, not duplicated
- [🟢] Method sizes respected

### Security

- [🟢] No new surface

### Error management

- [🟢] `InputRequiredError` thrown correctly for unknown `mcpFilter` values

### Performance

- [🟢] Distribution generated once per tool (prepare phase), no double I/O

## Final Review

- **Score**: 7.5/10
- **Feedback**: Solid refactor. The two-phase pattern (prepare → aggregate → prompt once → apply) is clean and correctly solves the double-prompt bug in both install and update. `McpUseCase` centralisation is the right call. Three minor issues to fix before merge.
- **Follow-up Actions**:
  1. Add `config: ReturnType<typeof getToolConfig>` to `ToolInstallData`, remove second `getToolConfig` call in `installOneToolFromData`
  2. Restore two WHY comments in `update-use-case.ts`
  3. Break `prepareToolUpdate` return line across multiple lines
- **Additional Notes**: Test coverage is thorough. The `defaultChecked` parameter cleanly captures the install/update semantic difference without branching in the shared use case.
