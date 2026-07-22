---
name: audit
description: Independent audit of domain/formats, domain/capabilities, domain/tools against format/capability/tool layer skills
argument-hint: N/A
---

# Codebase Audit for domain/formats + domain/capabilities + domain/tools

Audit of 3 domain layers against their authoritative layer skills (format, capability, tool) and project rules (.claude/rules/).
Scope: src/domain/formats/ (22 files), src/domain/capabilities/ (9 files), src/domain/tools/ai/ (6 files).

- Status: COMPLETE
- Confidence: HIGH
- Scope: src/domain/formats/, src/domain/capabilities/, src/domain/tools/ai/

## Skill Verdicts

| Layer | Skill | Verdict | Evidence |
|-------|-------|---------|----------|
| domain/formats/ | `format` | **FIX APPLIED** | 6 no-inverse comments added (jsonc.ts, agent-frontmatter-strip.ts, cursor-hooks.ts, relative-link-rewrite.ts, codex-agent-toml.ts, vscode-mcp-merge.ts) |
| domain/capabilities/ | `capability` | **CONFIRMED CLEAN** | 0 violations across all 9 files; all rules satisfied |
| domain/tools/ | `tool` | **CONFIRMED CLEAN** | 0 new violations; 2 pre-documented exemptions re-verified |

## Findings

- [🟢] **Format skill — named exports**: All 22 format files use named exports only. No default exports found.
- [🟢] **Format skill — no any**: Zero `any` types in domain/formats/.
- [🟢] **Format skill — .js imports**: All relative imports in domain/formats/ carry `.js` extension.
- [🟢] **Format skill — no I/O**: `node:path` in relative-link-rewrite.ts is pure path math, not filesystem I/O. `Hasher` in opencode-mcp-merge.ts is a deterministic computation port — no I/O. Both acceptable.
- [🟢] **Format skill — round-trip inverses documented**: 6 one-way transforms now carry explicit "No inverse" comments per skill rule. All 6 were added in P2.
- [🟢] **Format skill — CONSTANT_CASE for repeated literals**: CLAUDE_ROOT_PREFIX, DEFAULT_RELATIVE_PREFIX, FRONTMATTER_DELIMITER, CONSTANT pattern followed throughout.
- [🟢] **Format skill — file naming**: All format files follow `<concept>.ts` convention.
- [🟢] **Capability skill — Has* interfaces**: 8 Has* interfaces in contracts.ts map exactly to 8 capability classes. No orphan interfaces or classes.
- [🟢] **Capability skill — constructor params object**: All 8 capability classes accept a single `readonly params` object. No positional arguments.
- [🟢] **Capability skill — readonly public fields**: All public class-level fields in capability classes are `readonly`. Nested params-object fields are within the immutable `readonly params` reference.
- [🟢] **Capability skill — CapabilityConfigError**: Used in PluginsCapability (userScope guard), SettingsCapability (mutual-exclusion guards ×3), SkillsCapability (prefix-or-directory guard). Correctly applied where invalid params are possible.
- [🟢] **Capability skill — named exports**: All 8 capability classes use named exports only.
- [🟢] **Capability skill — no any**: Zero `any` types in domain/capabilities/.
- [🟢] **Capability skill — .js imports**: All relative imports in domain/capabilities/ carry `.js` extension.
- [🟢] **Capability skill — no instanceof presence guards**: No `instanceof` used for capability presence checks in the domain.
- [🟢] **Tool skill — AiTool<C> type annotation**: All 5 AI tools (claude, cursor, copilot, opencode, codex) use `AiTool<Has* & ...>` type parameter. Correct capability intersections.
- [🟢] **Tool skill — signalDir non-null**: All 5 tools have non-null signalDir pointing to their commands/prompts directory. Registry `hasToolSignals()` correctly uses these.
- [🟢] **Tool skill — registerTool at bottom**: All 5 tool files call `registerTool()` as the final statement. No tool is registered from outside the module.
- [🟢] **Tool skill — named exports**: All 5 tools use `export const <toolId>`. No default exports.
- [🟢] **Tool skill — no any**: Zero `any` types in domain/tools/ai/.
- [🟢] **Tool skill — .js imports**: All relative imports in domain/tools/ai/ carry `.js` extension.
- [🟢] **Tool skill — PluginsCapability/marketplaceSettings**: All 5 tools configure PluginsCapability correctly. marketplaceSettings present for translationMode="marketplace" (claude, cursor, codex, copilot). opencode uses flat mode correctly.
- [🟡] **Tool skill — rewriteContent/reverseRewriteContent losslessness**: claude.ts, codex.ts, cursor.ts, opencode.ts have command-path rewrites in `rewriteContent` that are not reversed in `reverseRewriteContent`. This is intentional: rewrite is BUILD-time on framework content; reverse is SYNC-time on already-flattened user files. Pre-documented in apply-skills-clean-code.done.md as "chained-transform exemption." Exemption re-verified as still valid — no user-installed file ever contains unflattened `commands/XX_foo/` patterns. Low risk.
- [🟡] **Method size — copilot.ts**: `rewriteCopilotContent` (27 code lines) and `reverseCopilotContent` (29 code lines) exceed the 20-line hard limit. Pre-documented as "chained-transform exemption" (sequential `.replace()` chains with no extractable sub-concepts). Exemption re-verified as still valid. Low risk.
- [🟡] **Method size — PluginsCapability constructor**: Constructor (29 code lines) exceeds 20-line limit. Pre-documented as "TypeScript readonly constraint exemption" (all class-level fields must be assigned in constructor; extracting to private methods would require removing `readonly`). Exemption re-verified as still valid. Low risk.
- [🟡] **Format skill — marketplace-entry.ts placement**: `buildClaudeStyleMarketplaceEntry` is a pure function in domain/capabilities/ rather than domain/formats/. Not a capability class. This is a minor layer-placement question; the file is a shared helper tightly coupled to PluginsCapability types. Not a format-skill violation per se. Low risk, could be addressed in a future refactor.
- [🟡] **Test coverage — format layer**: `codex-paths.ts` (constants only, no test needed), `jsonc.ts` (used in test helpers but no dedicated unit test), `markdown-references.ts` (tested indirectly in doctor-use-case), `mcp-format.ts` (tested indirectly through codex e2e), `placeholders.ts` (identity functions, trivial). Direct unit tests would strengthen coverage for `jsonc.ts` and `mcp-format.ts`. Low risk.
- [🟢] **Architecture — dependency direction**: Zero cross-layer imports. domain/formats, capabilities, and tools/ai never import from application or infrastructure layers.
- [🟢] **Error handling — no raw Error**: Zero `throw new Error(` in all 3 layers. All typed error classes used (CapabilityConfigError, ForeignSchemaValidationError, InvalidPluginManifestError, etc.).
- [🟢] **Dead code — no debug artifacts**: Zero console.log, no unused imports flagged by typecheck.

## ✅ Audit Checklist

### Dead and unused code

- [x] Unreachable code paths — NONE found
- [x] Unused exports, types, helpers — typecheck + knip confirm zero dead exports in scope
- [x] Stale comments, TODOs — NONE in the 3 layers
- [x] Vestigial feature flags — NONE

### Duplication

- [x] Same logic copy-pasted — minor: marketplace parse pattern repeated across cursor/codex/copilot/opencode marketplaces (intentional, each format is independent)
- [x] Re-implemented standard library helpers — NONE
- [x] Repeated test setup blocks — out of scope

### Complexity

- [x] Cyclomatic complexity — all functions within bounds (most ≤10 branches)
- [x] File length — all format/capability files under 200 lines; codex.ts (276) and copilot.ts (357) are the largest tools but well-organised
- [x] Nesting depth — max 3 levels; acceptable

### Standards and conventions

- [x] Naming conventions — CONSTANT_CASE, camelCase, PascalCase all followed
- [x] Project coding rules respected — all rules from .claude/rules/ satisfied
- [x] .js ESM imports — confirmed across all 3 layers
- [x] Folder structure matches architecture — domain layers correctly isolated

### Error handling

- [x] Errors caught at correct boundary — domain layer throws; no try/catch except in parseSafe helpers
- [x] No silent swallows — all catch blocks either rethrow or return typed errors
- [x] Raw Error uses — ZERO in domain layers
- [x] Recovery paths — tested via e2e

### Test coverage

- [x] Critical paths covered — all 5 AI tools have unit test files; all 8 capabilities have unit test files; 18/22 format modules have direct unit tests
- [x] Tests assert behavior — confirmed (existing test suite, 1816 tests)
- [ ] 4 format modules lack direct unit tests (jsonc.ts, mcp-format.ts, markdown-references.ts, codex-paths.ts) — covered indirectly but unit tests would be stronger

### Performance

- [x] No N+1 patterns in domain layer (pure functions, no queries)
- [x] Heavy operations not present in domain layer scope

### Security

- [x] Input validation at boundaries — CapabilityConfigError used; typed errors on invalid params
- [x] No secrets in domain layer
- [x] No authentication logic in domain layer (out of scope)

## Recommendations

Ranked by impact (high to low):

1. Add direct unit tests for `jsonc.ts:stripJsonComments` and `mcp-format.ts:mcpJsonToToml` — these are non-trivial parsing functions (47 and 92 lines) with edge-case complexity, currently only tested indirectly.
2. Consider moving `marketplace-entry.ts` to `domain/formats/` in a future refactor — it is a pure function helper not a capability class, so domain/formats/ is the more accurate home.
3. Document the rewriteContent asymmetry in the tool skill's content-rewrite reference — the "chained-transform exemption" exists in task docs but not in the skill itself, creating a readability gap for future contributors.

## Final Audit

- **Score**: 93/100
- **Top risks**: Pre-documented exemptions for method-size (copilot.ts, PluginsCapability); indirect test coverage for jsonc.ts and mcp-format.ts
- **Quick wins**: Add unit tests for jsonc.ts and mcp-format.ts (2 small test files, each ~5-10 tests)
- **Follow-up actions**: Document content-rewrite exemption in tool skill; consider marketplace-entry.ts relocation
- **Additional notes**: All 3 layer skills (format, capability, tool) have been verifiably exercised — format drove 6 fixes, capability confirmed 0 violations, tool confirmed 0 violations with 2 exemptions re-verified. pnpm typecheck + pnpm test (1816/1816) + pnpm build (400.80 KB) all pass.
