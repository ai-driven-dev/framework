# CLI v5 Cleanup — Plugin Sync Inter-Tool Matrix

Date: 2026-05-06
Branch: feat/cli-v5-cleanup
Binary: `node dist/cli.js` (v4.1.0-beta.11)

## Scope

Tests `plugin sync` and `ai sync` capability translation between all source×target pairs.
opencode deferred (no test fixture).
Marketplace native format adapters (Cursor/Copilot/Codex marketplace ingestion) are explicitly out of scope.

## Plugin (marketplace) Sync Matrix

Method: `plugin install aidd-test --tool <source> --yes` → `ai install <target>` → `plugin sync --source <source> --target <target>`
Plugin used: `aidd-test` (from bundled fixture marketplace `aidd-framework`)
Capabilities: commands, rules, skills, agents (no hooks, no mcp in aidd-test fixture)

| Source | Target | Exit | Plugin propagated | Result |
|---|---|---|---|---|
| claude | cursor | 0 | aidd-test@0.1.0 | PASS |
| claude | copilot | 0 | aidd-test@0.1.0 | PASS |
| claude | codex | 0 | aidd-test@0.1.0 | PASS |
| cursor | claude | 0 | aidd-test@0.1.0 | PASS |
| cursor | copilot | 0 | aidd-test@0.1.0 | PASS |
| cursor | codex | 0 | aidd-test@0.1.0 | PASS |
| copilot | claude | 0 | aidd-test@0.1.0 | PASS |
| copilot | cursor | 0 | aidd-test@0.1.0 | PASS |
| copilot | codex | 0 | aidd-test@0.1.0 | PASS |
| codex | claude | 0 | aidd-test@0.1.0 | PASS |
| codex | cursor | 0 | aidd-test@0.1.0 | PASS |
| codex | copilot | 0 | aidd-test@0.1.0 | PASS |

All 12 pairs: plugin propagated via marketplace reference (re-install from same source), no failures.

Note: local-path plugins (added via `plugin add`) cannot be propagated — this is expected behavior. The warning "Plugin has no marketplace — cannot propagate" is intentional. Marketplace-registered plugins propagate correctly across all pairs.

---

## AI Config Sync (component file re-translation) Matrix

Method: `plugin add <format-fixture> --tool <source>` → modify component file → `ai sync --source <source> --target <target> --force`

Format fixtures available:
- `claude-format/sample-plugin`: commands + agents + skills + hooks
- `cursor-format/sample-plugin`: commands only

Tools without dedicated format fixtures: copilot, codex (no tool-specific capability directories)

| Source | Target | Exit | Synced files | Capabilities translated | Result |
|---|---|---|---|---|---|
| claude | cursor | 0 | 1 (commands/greet.md) | commands | PASS |
| claude | copilot | 0 | 0 (nothing to sync) | n/a — copilot has no plugin dir | NOTE |
| claude | codex | 0 | 0 (nothing to sync) | n/a — codex has no plugin dir | NOTE |
| cursor | claude | 0 | 1 (commands/greet.md) | commands | PASS |
| cursor | copilot | 0 | 0 (nothing to sync) | n/a | NOTE |
| cursor | codex | 0 | 0 (nothing to sync) | n/a | NOTE |
| copilot | claude | 0 | 0 (no format fixture) | n/a | NOTE |
| copilot | cursor | 0 | 0 (no format fixture) | n/a | NOTE |
| copilot | codex | 0 | 0 (no format fixture) | n/a | NOTE |
| codex | claude | 0 | 0 (no format fixture) | n/a | NOTE |
| codex | cursor | 0 | 0 (no format fixture) | n/a | NOTE |
| codex | copilot | 0 | 0 (no format fixture) | n/a | NOTE |

All 12 pairs: exit 0. No errors.

---

## Per-Capability Translation Status

### claude ↔ cursor (bidirectional)

| Capability | Translation status | Notes |
|---|---|---|
| commands | Translated | Component files synced correctly in both directions |
| rules | No fixture tested | claude has `.claude/rules/`, cursor has `.cursor/rules/` — structure exists, no modified-file test |
| skills | No fixture tested | Component paths tracked in manifest; sync follows componentPaths |
| agents | No fixture tested | Component paths tracked in manifest |
| hooks | Gap | No cross-tool hook translation (hooks are tool-specific: hooks.json for claude, not applicable to cursor) |
| mcp | Gap | MCP config is tool-specific format; not translated by ai sync (deferred to format-adapter master plan, decision #12) |

### claude / cursor → copilot / codex

| Capability | Translation status | Notes |
|---|---|---|
| commands | Gap | copilot and codex have no plugin command directory structure; ai sync cannot translate component files |
| rules | Gap | Same — no plugin rule dir for copilot/codex |
| skills | Gap | Same |
| agents | Gap | Same |
| hooks | Gap | Tool-specific |
| mcp | Gap | Tool-specific format |

---

## Documented Gaps (deferred — format-adapter master plan, decision #12)

1. **MCP config translation**: `mcp.json` (claude) ↔ tool-specific MCP configs (cursor, copilot, codex) not translated by ai sync. Each tool reads its own MCP config format.

2. **copilot/codex component dirs**: These tools have no `.cursor/plugins/` equivalent directory structure for plugin-capability files. Plugin propagation via `plugin sync` works (re-installs from marketplace), but `ai sync` component-file re-translation has no target path for capabilities.

3. **hooks cross-tool**: Claude hooks (`hooks.json` + `.js` scripts) have no equivalent in cursor/copilot/codex. Not translated.

4. **Local-path plugin propagation**: `plugin add <path>` creates a plugin with no marketplace reference. `plugin sync` correctly warns and skips. This is by design — local plugins must be manually added to each tool.

5. **opencode deferred**: No test fixtures exist for opencode format. Deferred per task spec.

---

## Summary

- 12/12 plugin (marketplace) sync pairs: PASS
- 2/12 ai sync component-translation pairs with real data: PASS (claude↔cursor)
- 10/12 pairs: nothing to sync (no format fixture for copilot/codex, or only tool-specific hooks/mcp)
- 0 errors across all 24 test runs
- Gaps documented: MCP translation, copilot/codex component dirs, hooks cross-tool, opencode
- All gaps are intrinsic to the current architecture (deferred to format-adapter master plan, decision #12)
