---
plan_id: 258-mode-b-parity
ticket: https://github.com/ai-driven-dev/aidd-cli/issues/258
repo: ai-driven-dev/aidd-cli
branch: feat/258-mode-b-parity
date: 2026-05-23
objective: Bring Mode B (flat materialization) to functional parity with Mode A for hooks and MCP across OpenCode (project flat) and Cursor (user-scope flat), per the LOCKED per-tool decision matrix in issue #258.
success_condition: "pnpm test && pnpm typecheck && pnpm knip:production && pnpm lint"
acceptance_criteria:
  - Cursor flat install of a plugin with hooks/ writes a converted <plugin>/hooks.json (camelCase events, ${CLAUDE_PLUGIN_ROOT}/ rewritten).
  - Cursor flat install of a plugin with .mcp.json writes <plugin>/mcp.json.
  - OpenCode flat install of a plugin with .mcp.json merges servers into opencode.json mcp section. Disabled servers stay disabled. Idempotent re-install does not duplicate keys.
  - OpenCode flat install of a plugin with hooks/ skips them and emits a clear logger.warn naming the plugin + reason.
  - scripts/ never materialized (already enforced at reader level).
  - Uninstall removes Cursor hooks.json/mcp.json (tracked in Plugin.files) and OpenCode opencode.json MCP entries (tracked separately).
  - Plugins shipping zero hooks AND zero mcp produce zero warnings.
  - Mode A behavior is unchanged.
---

## Critical re-framing before reading the phases

The spec headline "extend translateFlat for hooks + mcp" only fully applies to **OpenCode**. Cursor's flat install actually flows through `PluginTranslator.translateNativeWithPaths` (see `cursor.ts`: `mode: "native"`, `installScope: "user"`) — the `ModeBFlatMaterializationAdapter` accepts both `flat` and `native+user`. As a result, **most of the Cursor work is capability config flips in `cursor.ts`**, not new translator branches. `translateNativeWithPaths` already calls `maybeConvertHooks` which already routes through `convertHooksFormat`/`convertClaudeHooksToCursorPlugin`; once `acceptsHooks`, `hooksContentFormat: "cursor"`, `acceptsMcp`, and the right relative paths are set, Cursor parity is largely "wire it on, write tests."

The architecturally novel piece is OpenCode MCP merge into `opencode.json` from a translator path. That's where the design decisions concentrate (see D2/D3).

---

## M / C / D

### Must

- **M1.** `PluginTranslator` returns a `skipped: Array<{ component, tool, reason }>` alongside `files` for both flat and native-flat paths; install use-case logs `logger.warn` per entry. Zero-component plugins produce zero warnings.
- **M2.** Cursor (mode `native`, scope `user`) capability config gains `acceptsHooks: true`, `hooksContentFormat: "cursor"`, `hooksRelativePath: "hooks.json"`, `acceptsMcp: true`, `mcpRelativePath: "mcp.json"`. Output lands at `~/.cursor/plugins/local/<plugin>/hooks.json` and `~/.cursor/plugins/local/<plugin>/mcp.json` and is tracked in `Plugin.files` so existing uninstall removes it.
- **M3.** `translateFlat` (OpenCode-only effective callers in this phase) iterates `dist.components.hooks`: emits no files, emits a skip entry (`component: "hooks"`, `reason: "OpenCode plugin runtime is JS modules; declarative hooks.json is not supported."`).
- **M4.** `translateFlat` iterates `dist.components.mcp` (when length > 0): for OpenCode, transforms via `transformMcpToOpencode` and **merges into `opencode.json` mcp section**, keyed by server name, **idempotently** (re-install does not duplicate), preserving user-added servers, preserving `enabled: false` from the source `.mcp.json`. Disabled-state preservation requires extending `transformMcpToOpencode` to read source `disabled` / `enabled` keys (currently hardcoded `enabled: true` on lines 78 & 83 of `opencode.ts`).
- **M5.** OpenCode `opencode.json` MCP entries contributed by a plugin are removed on `aidd plugin remove` — tracked via a new `mcpEntries: ReadonlyMap<string, string>` (server name → hash) field on the `Plugin` model, or via reuse of `ToolEntry.mergeFiles` semantics (chosen path: see D2).
- **M6.** Logger surfacing: `PluginAddUseCase.execute` (and the `ModeBFlatMaterializationAdapter` path) accept a `Logger` port and emit one `logger.warn` per skip entry with the format `Plugin "<pluginName>": <component> skipped for <toolId> — <reason>`.
- **M7.** Docs: `aidd_docs/translator-dual-mode.md` gains a "Mode B component matrix" section reflecting the LOCKED matrix.
- **M8.** CHANGELOG entry under Unreleased.

### Could (deferred, not in this ticket unless time allows)

- **C1.** Generalize the OpenCode MCP merge path so future flat tools with MCP merge (none exist today) reuse it. Acceptable in this ticket if the design is clean; not required.
- **C2.** Walk `~/.cursor/plugins/local/` to detect added-but-untracked files for `aidd ai status` user-scope drift (called out as deferred in plan 192 D3 — still deferred).
- **C3.** A future translator capability flag `acceptsHooks: "skip-with-warn"` to formalize the OpenCode hooks situation instead of branching by toolId. Acceptable only if it simplifies; otherwise keep the branch.

### Don't

- **D-X1.** Do NOT translate OpenCode hooks into JS plugin modules (out of scope per spec, locked).
- **D-X2.** Do NOT propagate `scripts/` anywhere (already filtered at reader level — verify only, don't touch).
- **D-X3.** Do NOT auto-enable plugin-shipped MCP servers that are marked disabled — preserve their disabled state.
- **D-X4.** Do NOT change Mode A behavior (Claude/Copilot/Codex marketplace flow). No edits to those tool files.
- **D-X5.** Do NOT change `Plugin.files` keying semantics (install-base-relative strings) established by plan 192 D2.
- **D-X6.** Do NOT replace `ModeBFlatMaterializationAdapter`'s native+user acceptance — Cursor depends on it.

---

## Decisions

### D1 — Skip list shape and propagation

`PluginTranslator.translateWithComponentPaths` returns a third field `skipped: ReadonlySkipList` where:

```ts
interface PluginTranslationSkip {
  readonly pluginName: string;
  readonly component: "hooks" | "mcp" | "scripts";
  readonly toolId: AiToolId;
  readonly reason: string;
}
type ReadonlySkipList = readonly PluginTranslationSkip[];
```

Type lives in `src/domain/models/plugin-translation-skip.ts` (new file, per `0-discriminant-types.md` — no inline union in use-case).

`ModeBFlatMaterializationAdapter.addPlugin` plumbs `skipped` back up via a new return type (currently `Promise<void>`). To avoid breaking the `PluginTranslationAdapter` interface, addPlugin returns `Promise<{ skipped: ReadonlySkipList }>`. The native marketplace adapter (Mode A) returns an empty list.

`PluginAddUseCase` gains a constructor-injected `Logger` (port at `src/domain/ports/logger.ts`). After each `addPluginForTool`, the collected skip list is emitted as `logger.warn` lines. Zero-length list → zero log lines (no noise for plugins without hooks/mcp).

**Rejected alternative:** thread skip list through the Manifest or through CLIOutput. Manifest holds installed-state, not transient signals (`8-manifest.md`). CLIOutput is the command-layer wrapper around Logger; the port is `Logger`, per `0-hexagonal.md` and `3-cli-output.md` ("conflicts and skips → warn"). Adapters/use-cases speak the port.

### D2 — OpenCode MCP merge: tracking model

**Decision: extend `Plugin` model with a `mcpEntries: ReadonlyMap<string, string>` field (server-name → MD5 hash of the contributed server JSON).**

- `mcpEntries` mirrors `Plugin.files` semantics but for server-name keys.
- `Plugin.fromDistribution` accepts an extra `mcpEntries` arg (default empty Map) populated by the Mode B adapter when the OpenCode MCP merge happens.
- `PluginRemoveUseCase` gains a step that, for each removed plugin with non-empty `mcpEntries`, removes those exact keys from the target `opencode.json` `mcp` section, leaving every other server untouched. Re-uses `extractMcpKeys` / `filterMcpExclusions` patterns from `src/domain/models/mcp-exclusion.ts` where they fit; net-new helper if shape differs.

**Rejected: reuse `ToolEntry.mergeFiles`** — `mergeFiles` is keyed by file path with per-file hashes (`extractMergeEntries(content, sectionKey, hasher)`). Encoding "server name X in opencode.json" as a synthetic file path would be a hack that future readers would mis-handle. A dedicated `mcpEntries` map on `Plugin` is the smallest correct change.

**Rejected: track merged MCP via `Plugin.files` with a synthetic relative path like `__opencode.json#mcp.<name>__`** — same objection. `Plugin.files` is "files to delete from disk on uninstall," and `opencode.json` is not plugin-owned.

**Rejected: emit an `InstallationFile` with `mergeStrategy: "framework-prime"` and route through `InstallConfigUseCase`** — that pipeline serves install-time framework files keyed by `ConfigRef`, not plugin-time materialization. The two use-cases run at different times and consume different inputs; bolting plugin MCP onto `ConfigRef` semantics expands blast radius. Keep the merge inside the Mode B adapter (or a dedicated sub-use-case under `application/use-cases/plugin/translator/`) using existing format helpers from `domain/formats/mcp-format.ts` + `domain/models/mcp-exclusion.ts`.

**Concrete merge contract:**
1. Read `opencode.json` (or `opencode.jsonc` per existing `resolveOutputPath`) if it exists; parse as JSON; default to `{}` if absent.
2. Run `transformMcpToOpencode(plugin.mcp[0].content)` → `{ mcp: { ... } }` shape.
3. For each server name in the transformed result:
   - If name already exists in target and was contributed by another plugin: log warn + skip (collision; deterministic last-write-wins is risky on re-install).
   - If name exists and is user-owned (not in any plugin's `mcpEntries`): log warn + skip (do not overwrite user-added servers).
   - Otherwise: assign. Record `(serverName, hash)` in this plugin's `mcpEntries`.
4. Re-serialize and write through `fs.writeFile`.

**Idempotent re-install (same version):** because the merge is keyed by server name and only assigns when the slot is either empty or already owned by this plugin (manifest is consulted), a second `aidd plugin add` on the same plugin produces byte-identical `opencode.json`.

**Replace path (`--replace`, different versions):** `PluginAddUseCase.dropExistingPlugin` currently only drops the manifest entry in memory; it does **not** touch disk or unmerge. Without intervention, replacing plugin-X v1 (servers `{a, b}`) with plugin-X v2 (servers `{a, c}`) leaves orphan `b` in `opencode.json` forever — v2's `mcpEntries` won't list `b`, so the later `aidd plugin remove` cannot clean it. **Fix in Phase 4 by gating the merge through an unmerge pre-step:** before applying the new merge, if the manifest already has this plugin name for this tool, unmerge that plugin's previous `mcpEntries` from `opencode.json` first. The same unmerge primitive is then reused by `PluginRemoveUseCase` in Phase 5 — extract it into `opencode-mcp-merge.ts` (or a sibling helper) so both call sites share the implementation. This change is confined to Phase 4 and does not attempt to fix the pre-existing replace-path behavior for other tracking surfaces (Cursor file cleanup on replace is a separate, pre-existing issue out of scope here).

### D3 — Cursor: capability config flips, not translator code

`cursor.ts` `plugins` capability gains:
```ts
acceptsHooks: true,
hooksRelativePath: "hooks.json",        // plugin-local, not nested
hooksContentFormat: "cursor",
acceptsMcp: true,
mcpRelativePath: "mcp.json",            // plugin-local, not nested
```

Effects:
- `translateNativeWithPaths` already iterates `dist.files` (which includes `hooks/hooks.json` and `.mcp.json`), already calls `translateFile` which already honors `acceptsHooks` / `acceptsMcp`, already calls `maybeConvertHooks` which already calls `convertHooksFormat` (Cursor format).
- `pluginRoot` is `<pluginName>/` (Cursor declares `pluginsDir: ""`), so the absolute write is `~/.cursor/plugins/local/<pluginName>/hooks.json` and `~/.cursor/plugins/local/<pluginName>/mcp.json`.
- These paths land in `Plugin.files` via existing `componentPaths` / `Plugin.fromDistribution` flow → existing `PluginRemoveUseCase.deletePluginFiles` already removes them on uninstall. **No new uninstall code for Cursor.**

**Inline-comment-rule check:** the new boolean/string knobs are not magic values in the use-case sense (they belong inside the tool definition, which is the canonical place per `0-tool-config.md`). No new module-level constants needed.

### D4 — OpenCode hooks: skip + warn from `translateFlat`

`translateFlat` already iterates `dist.components.commands/agents/rules/skills`. Add: iterate `dist.components.hooks`. For OpenCode the cap will have `acceptsHooks` effectively false (FlatPluginsParams currently has no `acceptsHooks` field — leaving it as the implicit `false` in `PluginsCapability` is fine). When `dist.components.hooks.length > 0` and the cap reports the tool cannot accept hooks → emit one skip entry per tool (not per file), reason: `"OpenCode plugin runtime is JS modules; declarative hooks.json is not supported."` Crucially: **no skip entry when `dist.components.hooks.length === 0`** (prevents warning noise on plugins like `aidd-pm` that ship no hooks).

### D5 — `transformMcpToOpencode` must preserve disabled state

Current code (`opencode.ts` lines 78, 83) hardcodes `enabled: true`. The LOCKED matrix requires disabled servers to stay disabled. The plugin shipped `.mcp.json` (Claude-style format) uses a `"disabled": true` key on servers. Extension:

```ts
const sourceDisabled = "disabled" in server && (server as { disabled?: boolean }).disabled === true;
const enabled = !sourceDisabled;
```

Apply to both branches. Unit test in `opencode.unit.test.ts` (or wherever the existing `transformMcpToOpencode` tests live). If no existing test file: create `src/domain/tools/ai/opencode.unit.test.ts` per `5-test-pyramid.md` (pure function → unit test).

### D6 — Skip warning location: use-case, not adapter

Per `3-cli-output.md` ("conflicts and skips → warn, never error") and `0-hexagonal.md` (`CLIOutput` lives in `application/`), the `logger.warn` call sits in `PluginAddUseCase`, not in the translator (which is a domain model) and not in the adapter (which should stay I/O-only). Adapters return skip lists; the use-case logs them.

---

## Rules table

| Phase | Rules that apply |
|-------|------------------|
| All   | `0-hexagonal.md` (layer direction), `1-naming.md` (kebab-case `.ts`, `*-use-case.ts`, `*.unit.test.ts`, `*.integration.test.ts`), `1-exports.md` (named exports only, no barrels), `2-typescript.md` (no `any`, `import type`, `.js` ESM ext), `4-biome.md` (lint/format), `6-method-size.md` (≤20 lines per method, extract helpers), `7-clean-code.md` (YAGNI, fail-fast guards, named constants). |
| Phase 1 (skip plumbing) | `0-discriminant-types.md` (`PluginTranslationSkip` in `domain/models/`, not inline), `6-use-case.md` (single `execute`, typed Options/Result), `6-shared-use-cases.md` if any helper sub-use-case is split, `3-cli-output.md` (Logger ≠ CLIOutput; `warn` channel for skips). |
| Phase 2 (Cursor parity) | `0-tool-config.md` (capability config in `tools/ai/cursor.ts`), `5-test-pyramid.md` (integration test for use-case via in-memory FileWriter port, asserting Cursor user-scope file layout). |
| Phase 3 (OpenCode hooks skip) | `7-clean-code.md` KISS branch, `5-test-pyramid.md` (unit test on `translateFlat` skip emission, plus an integration test asserting `logger.warn` is emitted exactly once for a plugin with hooks). |
| Phase 4 (OpenCode MCP merge) | `8-manifest.md` (every installed contribution tracked; uninstall removes tracked contributions), `8-value-objects.md` (`Plugin.mcpEntries` field is `readonly`, validated in constructor), `0-error-handling.md` (adapters translate raw errors to typed domain exceptions), `0-post-install-pipeline.md` (manifest save still goes through `PluginAddUseCase` → `manifestRepo.save`, no separate pipeline call required since it stays inside the existing flow). |
| Phase 5 (uninstall) | `8-manifest.md` (uninstall removes tracked files AND tracked merge contributions), `6-use-case.md` (≤20 lines per method — extend `PluginRemoveUseCase` with a small private helper, do not balloon `execute`). |
| Phase 6 (docs + changelog) | `1-command-structure.md` doesn't apply (no commands changed). Plain markdown edit only. |

---

## Phases

Six phases, sequenced so each ships a coherent slice; the seams that come later depend on Phase 1.

### Phase 1 — Skip-list plumbing (smallest seam, lands first)

**Scope.** Introduce the skip-list value type, thread it through translator + adapter + use-case, log via `Logger`. No behavioral change for any tool yet — translator never emits a skip entry until Phase 3.

**Files touched.**
- new: `src/domain/models/plugin-translation-skip.ts` — defines `PluginTranslationSkip` interface and `ReadonlySkipList` alias. Pure types, no logic.
- `src/domain/models/plugin-translator.ts` — `translateWithComponentPaths` return type gains `skipped: ReadonlySkipList`. `translateFlat` and `translateNativeWithPaths` both return empty `[]` for now. `detectFlatCollisions` unaffected.
- `src/application/use-cases/plugin/translator/plugin-translation-adapter.ts` — interface `addPlugin` return type changes from `Promise<void>` to `Promise<{ skipped: ReadonlySkipList }>`.
- `src/application/use-cases/plugin/translator/mode-b-flat-materialization-adapter.ts` — returns the skipped list it received from the translator.
- Mode A native marketplace adapter (find via `resolveTranslationAdapter`) — returns `{ skipped: [] }`.
- `src/application/use-cases/plugin/plugin-add-use-case.ts` — constructor gains `private readonly logger: Logger`. Per `6-use-case.md` injection order (FileSystem → Repository → Loader → Hasher → Logger → Platform → Prompter), the new param goes **after `hasher`, before `marketplaceRegistry`**. `addPluginForTool` collects skip entries; after the loop, log one `logger.warn` per entry.
- `src/infrastructure/deps.ts` — wire the existing logger instance into `PluginAddUseCase` at the new constructor position.

**Tests added.**
- unit: `src/domain/models/plugin-translator.unit.test.ts` — assert empty skipped list returned in both modes when there are no hooks/mcp.
- integration: `src/application/use-cases/plugin/plugin-add-use-case.integration.test.ts` — assert that with a stub adapter that returns a single skip entry, the in-memory logger receives exactly one `warn` line matching the format.

**Acceptance check.** `pnpm test && pnpm typecheck` green. No production behavior change (`pnpm e2e` for existing plugin-add flow unchanged).

### Phase 2 — Cursor flat hooks + mcp parity (capability config + tests)

**Scope.** Flip the four config knobs in `cursor.ts` so existing `translateNativeWithPaths` machinery starts producing `<plugin>/hooks.json` (via `convertClaudeHooksToCursorPlugin`) and `<plugin>/mcp.json` (passthrough).

**Files touched.**
- `src/domain/tools/ai/cursor.ts` — `plugins` capability params extended (D3). Add inline comment explaining the relative path choice ("plugin-local: Cursor auto-discovers `hooks.json` and `mcp.json` at the plugin root").
- (none in translator; existing `translateFile` and `maybeConvertHooks` handle it.)

**Tests added.**
- integration: `src/application/use-cases/plugin/plugin-add-cursor.integration.test.ts` — install a fixture plugin with both `hooks/hooks.json` (Claude-format events: `PreToolUse`, `PostToolUse`) and `.mcp.json` (one local, one remote, one with `disabled: true`). Assert:
  - `~/.cursor/plugins/local/<plugin>/hooks.json` exists, parses to `{ hooks: { preToolUse: [...], postToolUse: [...] } }`, all `${CLAUDE_PLUGIN_ROOT}/` replaced by `./`.
  - `~/.cursor/plugins/local/<plugin>/mcp.json` exists, byte-equal to the source `.mcp.json` (Cursor consumes Claude shape natively).
  - Both files appear in `Plugin.files` (manifest tracking).
  - No skip warnings emitted.
- integration: `plugin-remove-cursor.integration.test.ts` — after add → remove. Assert both files are deleted and the plugin name is removed from manifest. (Confirms existing `deletePluginFiles` covers the new files without code changes.)

**Acceptance check.** New tests pass. Existing Cursor tests (look in `src/application/use-cases/plugin/`) still pass — `pnpm test`.

### Phase 3 — OpenCode hooks: skip + warn

**Scope.** Extend `translateFlat` to iterate `dist.components.hooks`; for OpenCode emit a single skip entry per plugin (not per file) when `hooks.length > 0`. Zero hooks → zero skip entries.

**Files touched.**
- `src/domain/models/plugin-translator.ts` — inside `translateFlat`, after the existing component loop, add a guarded section:
  - if `dist.components.hooks.length > 0` and the tool's cap does not accept hooks, push one entry into a local skip array.
  - same shape considered for `mcp` in Phase 4 (don't preempt now).
  - Return signature already widened in Phase 1.
- `src/domain/models/plugin-translation-skip.ts` — add module-level `OPENCODE_HOOKS_SKIP_REASON` constant string (per `7-clean-code.md` magic-value rule — used once in code + asserted in tests).

**Tests added.**
- unit: extend `plugin-translator.unit.test.ts` — case where `dist.components.hooks` has one file → assert exactly one skip entry with `component: "hooks"`, `toolId: "opencode"`, matching reason. Case with zero hooks → zero entries.
- integration: `plugin-add-opencode-hooks-skip.integration.test.ts` — install a plugin with hooks against OpenCode; assert no `hooks/` files written and `logger.warn` called exactly once with the expected message.

**Acceptance check.** New tests pass. Cursor parity from Phase 2 unaffected (Cursor's `acceptsHooks: true` means no skip entry).

### Phase 4 — OpenCode MCP merge + disabled-state preservation

**Scope.** The architecturally novel slice. Extend `translateFlat` to iterate `dist.components.mcp`; for OpenCode, run the merge contract from D2. Extend `transformMcpToOpencode` per D5 to preserve `disabled` state. Extend the `Plugin` model with `mcpEntries`. Wire the Mode B adapter to call the merge and populate `mcpEntries` on the manifest entry.

**Files touched.**
- `src/domain/models/plugin.ts` — add `readonly mcpEntries: ReadonlyMap<string, string>` field, default empty Map. Extend `Plugin.fromDistribution` signature with an optional `mcpEntries` param. Validate invariants (no empty keys) in the constructor per `8-value-objects.md`.
- `src/domain/tools/ai/opencode.ts` — `transformMcpToOpencode` reads source `disabled` key and emits `enabled: !disabled` (D5). Keep the function pure.
- new: `src/application/use-cases/plugin/translator/opencode-mcp-merge.ts` — pure helper module exporting two functions:
  - `mergeOpencodeMcp(existing: string | null, incoming: string, otherPluginsEntries: ReadonlyMap<string, string>, previousEntriesForThisPlugin: ReadonlyMap<string, string>): { mergedContent: string, contributedEntries: ReadonlyMap<string, string>, collisions: ReadonlySkipList }`. The `previousEntriesForThisPlugin` param is the unmerge pre-step (D2 replace-path fix): those keys are stripped from `existing` before the new merge runs, so v1→v2 replace cleanly drops orphaned servers.
  - `unmergeOpencodeMcp(existing: string, entries: ReadonlyMap<string, string>): string`. Used standalone by `PluginRemoveUseCase` in Phase 5.
  - Both pure (no I/O); the adapter and the remove use-case do file read/write.
- `src/application/use-cases/plugin/translator/mode-b-flat-materialization-adapter.ts` — after `translateWithComponentPaths`, if `dist.components.mcp.length > 0` and the tool is OpenCode (gate on `tool.capabilities.mcp` presence + cap.params.entrySection === "mcp" — or a fresh, narrower predicate), resolve `opencode.json` path via the existing `resolveOutputPath`, read current content (if any) via a `FileReader` port (constructor-injected — currently only `FileWriter` is injected; widen), run `OpencodeMcpMergeUseCase`, write merged result. Populate `mcpEntries` on the manifest entry via `Plugin.fromDistribution`.
- `src/infrastructure/deps.ts` — wire `FileReader` into `ModeBFlatMaterializationAdapter`.

**Tests added.**
- unit: `opencode.unit.test.ts` — `transformMcpToOpencode` with mixed enabled/disabled servers, local + remote shapes. Existing test cases preserved.
- unit: `opencode-mcp-merge.unit.test.ts` — empty-target merge; merge into existing target with unrelated user servers (assert they're preserved); merge same plugin twice with same version (assert idempotent, byte-identical output); merge with `previousEntriesForThisPlugin` populated (assert replace-path unmerge drops orphaned keys before applying new entries — e.g. previous `{a, b}`, incoming `{a, c}` → result has `{a, c}`, no `b`); collision against another plugin's entry (assert skipped + reason); collision against user-owned entry (assert skipped + reason).
- integration: `plugin-add-opencode-mcp.integration.test.ts` — install plugin with `.mcp.json` (mix enabled/disabled, local/remote) against OpenCode; assert `opencode.json` contains all entries in the correct shape with `enabled` reflecting source `disabled`; assert `Plugin.mcpEntries` populated; assert no Mode A behavior changes for Claude.
- integration: `plugin-add-opencode-mcp-replace.integration.test.ts` — install plugin v1 with servers `{a, b}` → install plugin v2 (same name) with servers `{a, c}` using `--replace`. Assert `opencode.json` ends up with exactly `{a (v2 shape), c}`, no orphan `b`. Assert `Plugin.mcpEntries` on the manifest reflects v2's entries only.

**Acceptance check.** All new tests green. Idempotency test specifically asserts `pnpm test -- -t "idempotent"` produces byte-equal `opencode.json` on second add.

### Phase 5 — OpenCode plugin-remove: unmerge MCP entries

**Scope.** Make `aidd plugin remove` on OpenCode strip the contributed MCP entries from `opencode.json` without touching user-added servers.

**Files touched.**
- `src/application/use-cases/plugin/plugin-remove-use-case.ts` — after `deletePluginFiles`, if `plugin.mcpEntries.size > 0` and the tool is OpenCode, read `opencode.json`, remove the keys in `plugin.mcpEntries`, write back. Extract a private `removeMcpEntries(plugin, toolId, projectRoot)` helper to keep `removeFromTools` ≤20 lines.
- May need a small helper in `src/domain/models/mcp-exclusion.ts` (or a sibling) to remove keys from the OpenCode `mcp` section while preserving the rest of the JSON; reuse if already present.

**Tests added.**
- integration: `plugin-remove-opencode-mcp.integration.test.ts` — install plugin → assert opencode.json contains entries → remove → assert plugin's entries gone, unrelated user-added servers untouched. Also: remove plugin twice (second remove should error with `PluginNotFoundError` from existing logic — confirm).
- regression: re-run Cursor remove integration test to confirm no cross-talk.

**Acceptance check.** Manifest invariants hold: `manifest.getPlugins("opencode")` no longer contains the plugin; `opencode.json` minus the removed keys matches a pre-add snapshot of the file.

### Phase 6 — Docs + CHANGELOG

**Scope.** Update `aidd_docs/translator-dual-mode.md` with the Mode B component matrix mirroring the LOCKED matrix from the issue. Add a CHANGELOG entry under `## [Unreleased]` summarizing the parity work.

**Files touched.**
- `aidd_docs/translator-dual-mode.md`
- `CHANGELOG.md` (lives at repo root, confirmed). The project uses release-please (see recent commits `chore(main): release 4.1.2`), so the entry goes under the existing Unreleased section using Conventional Commits-aligned wording. Do not bump the version manually — release-please owns that.

**Tests added.** None (docs only).

**Acceptance check.** Manual diff review; markdown lint clean if applicable.

---

## Risk callouts

### R1 — `opencode.json` merge semantics (Phase 4)

- **Risk.** Naive write would either overwrite the whole file (destroying user-added servers) or fail to merge JSONC (preserving comments + trailing commas across read-merge-write is non-trivial).
- **Mitigation.** Restrict scope to JSON (`opencode.json`), matching how the existing `transformMcpToOpencode` already emits JSON. If the project has `opencode.jsonc`, the existing `OpencodeDualConfigError` is thrown; pass-through. Re-use the JSON.parse/JSON.stringify roundtrip already used in the file. Do NOT attempt to preserve comments — out of scope and the existing transformer doesn't.
- **Idempotency proof.** Merge is keyed by server name and gated by manifest ownership. Re-running `aidd plugin add` on the same plugin sees the same set of server names already owned by this plugin in the manifest → assigns identical content → JSON.stringify with same key order → byte-equal output. Test in `opencode-mcp-merge.unit.test.ts`.
- **Collision policy decision.** If a server name in the plugin's `.mcp.json` already exists in `opencode.json` and is NOT in any plugin's `mcpEntries` (i.e., user-added), the merge skips that key and logs a `logger.warn`. We deliberately do not overwrite user-owned config. This is one more skip-list contributor (`component: "mcp"`, reason: `"server <name> already exists in opencode.json (user-owned); plugin entry skipped"`).

### R2 — Cursor user-scope file lifecycle for uninstall

- **Risk.** `~/.cursor/plugins/local/<plugin>/` is shared across projects (per plan 192). If project A installs plugin X then project B installs plugin X (same name, different version perhaps), removing from project A could delete the files project B is using.
- **Mitigation.** This risk is **pre-existing** (plan 192 D4) and not in scope of #258 to fix. Phase 2 inherits the same semantics as today: `Plugin.files` tracks the new `hooks.json` and `mcp.json` per-project, and `PluginRemoveUseCase.deletePluginFiles` removes them on uninstall. Cross-project safety is governed by plan 192's resolution (or the lack thereof). Documented in `aidd_docs/translator-dual-mode.md` as a known limitation; not introduced by this ticket.

### R3 — Zero-component plugins emitting warning noise

- **Risk.** A plugin like `aidd-pm` (no hooks, no mcp) could trigger warnings if the skip emission is unconditional.
- **Mitigation.** Translator only emits a skip entry when `dist.components.hooks.length > 0` (Phase 3) or `dist.components.mcp.length > 0` and a real merge-collision occurs (Phase 4 / R1). Explicit unit tests assert zero skip entries for zero-component cases.

### R4 — `transformMcpToOpencode` disabled-state regression

- **Risk.** Existing callers (install-time MCP merge for the framework's own `.mcp.json` via `InstallConfigUseCase` → `McpCapability.transform`) would silently see different behavior if the framework's `.mcp.json` ever uses `disabled: true`.
- **Mitigation.** Today the framework `.mcp.json` does not ship `disabled: true` entries (verify in Phase 4 by grepping the framework repo — if any do exist, that's a separate signal). The change is strictly additive: only files with `disabled: true` get the new path. Add an explicit test for the existing "no disabled key" case so the regression net catches accidental flips.

### R5 — `ModeBFlatMaterializationAdapter` gains an opinion about OpenCode

- **Risk.** Adding "if tool is OpenCode, do MCP merge" to a shared adapter couples it to a specific tool — a violation of `0-tool-config.md`. Plan 192 rejected this exact pattern.
- **Mitigation.** Gate the merge on a capability predicate, not on `toolId === "opencode"`. Concrete predicate: `tool.capabilities.mcp instanceof McpCapability && tool.capabilities.mcp.params.mergeStrategy === "framework-prime" && tool.capabilities.plugins.mode === "flat"`. `McpCapability.params` is already declared `readonly params: { ... }` (public), so the predicate compiles without exposing new accessors. Today only OpenCode matches; tomorrow any flat-mode tool with `framework-prime` MCP merge auto-picks up the same behavior. Phase 4 acceptance includes asserting the predicate's wording and unit-testing it against a fake `AiTool` that doesn't match (no merge) and one that does (merge runs).

---

## Out of scope (echoed verbatim from spec)

- **OpenCode hooks translation** — skip + warn is the final answer (different runtime paradigm).
- **`scripts/` propagation** — build-time helper, dropped everywhere.
- **Auto-enabling MCP servers shipped as `"disabled": true`** — disabled stays disabled.
- **Changes to Mode A behavior** — Claude/Copilot/Codex marketplace flow untouched.

---

## Plan deviations

### D-PD1 — `opencode-mcp-merge.ts` location: `domain/formats/` (not `application/use-cases/plugin/translator/`)

The task spec places the helper at `src/domain/formats/opencode-mcp-merge.ts`; the phase-4 narrative placed it under `application/use-cases/plugin/translator/`. The helper is pure JSON-in/JSON-out with no I/O, which makes `domain/formats/` the correct location per `0-hexagonal.md` (pure transforms live in `domain/formats/`). The task spec is followed; the phase-4 narrative is overridden.

### D-PD2 — Simplified merge signature (no `otherPluginsEntries` collision param)

The plan called for `mergeOpencodeMcp(existing, incoming, otherPluginsEntries, previousEntriesForThisPlugin?)`. The simplified signature is `mergeOpencodeMcp(existing, incoming, previousEntriesForThisPlugin?, hasher?)`.

Semantic decision: strip `previousEntriesForThisPlugin` keys from `existing` first, then assign incoming servers wholesale. User-added servers (neither in previous nor incoming) are preserved by this approach. No collision detection against *other* plugins' entries — that collision path was never in the LOCKED matrix (it would require cross-plugin manifest inspection at format level, which violates layer rules). Acceptable for the current spec; collision detection can be added as a future concern.

### D-PD3 — `--replace` ordering: adapter reads previous `mcpEntries` from manifest before `dropExistingPlugin` removes them

`addLocalPlugin` calls `dropExistingPlugin` at line 137 before calling `addPluginForTool` at line 144. This means by the time the adapter runs, the manifest entry is already removed. The previous `mcpEntries` must be collected in `PluginAddUseCase` before the drop and passed to the adapter. Implementation: `addPluginForTool` signature gains an optional `previousMcpEntries?: ReadonlyMap<string, string>` param; `addLocalPlugin` reads `manifest.getPlugins(toolId).find(p => p.name === dist.manifest.name)?.mcpEntries` before the drop call.

---

## Definition of Done (mirrors spec acceptance criteria + project gates)

- [ ] All six phases shipped, each with its acceptance check green.
- [ ] `pnpm test && pnpm typecheck && pnpm knip:production && pnpm lint` all green.
- [ ] `aidd_docs/translator-dual-mode.md` updated with Mode B component matrix.
- [ ] CHANGELOG entry under Unreleased.
- [ ] Integration tests exist for every cell of the LOCKED matrix (Cursor hooks, Cursor mcp, OpenCode hooks skip, OpenCode mcp merge, scripts drop verification — already covered at reader level, add a regression assertion only if convenient).
- [ ] No new `any`, no inline discriminant unions, no methods >20 lines.
