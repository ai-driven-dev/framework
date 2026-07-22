# Instruction: feat(#262): plugin translator — real cross-tool translation

## Feature

- **Summary**: Plugin distribution `translateNative` currently pass-through copies source files into `<tool>/plugins/<name>/`. This patch rewrites translation to use the same per-tool capability pipeline as framework install/sync. Each source component (commands/agents/skills/rules/hooks/mcp) is dispatched via `Has<Capability>` on the target tool, transformed via capability's `buildInstallPath` + `convertFrontmatter` + `serialize`, and re-prefixed under `<pluginsDir><name>/`. Reader ingests `rules/`, `hooks/`, and `mcp.json` in addition to current commands/agents/skills. Plugin manifest emitted at target's native path (`.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/`, root). Flat mode (opencode) extended to all sections.
- **Stack**: TypeScript 5.x, Node.js >= 20, vitest
- **Branch name**: `feat/262-plugin-translator-real-translation`
- **Sequence**: `1 of 1`
- Confidence: 8/10
- Time to implement: 1 session (4-6h)

## What we have

| Piece | State |
|---|---|
| `PluginDistribution.translateNative` | pass-through copy — broken |
| `PluginDistribution.translateFlat` | commands only |
| `PluginDistributionReaderAdapter.isComponentFile` | whitelist: commands/agents/skills only |
| `PluginComponents` model | 3 arrays: skills/commands/agents |
| Per-tool capabilities | RICH: buildInstallPath, convertFrontmatter, serialize, toolSuffix |
| Per-tool `PluginsCapability` | mode + pluginsDir + pluginManifestRelativePath |

## Translation matrix (target = real per tool)

| Source | Claude | Cursor | Codex | Copilot | Opencode (flat) |
|---|---|---|---|---|---|
| `commands/foo.md` | `<n>/commands/foo.md` | `<n>/commands/foo.md` | `<n>/commands/foo.md` | `<n>/prompts/foo.prompt.md` | `commands/<n>/foo.md` |
| `agents/foo.md` | `<n>/agents/foo.md` | `<n>/agents/foo.md` | `<n>/agents/foo.toml` | `<n>/agents/foo.agent.md` | `agents/<n>/foo.md` |
| `rules/foo.md` | `<n>/rules/foo.md` | `<n>/rules/foo.mdc` | `<n>/rules/foo.md` | `<n>/instructions/foo.instructions.md` | `rules/<n>/foo.md` |
| `skills/foo/SKILL.md` | `<n>/skills/foo/SKILL.md` | (same) | (same) | (same) | `skills/<n>/foo/SKILL.md` |
| `hooks/hooks.json` | `<n>/hooks/hooks.json` | (skip — no HasHooks) | (skip) | `<n>/hooks/hooks.json` | (skip) |
| `.mcp.json` | `<n>/.mcp.json` | `<n>/mcp.json` | `<n>/.mcp.json` | `<n>/.mcp.json` | (skip) |
| `plugin.json` | `<n>/.claude-plugin/plugin.json` | `<n>/.cursor-plugin/plugin.json` | `<n>/.codex-plugin/plugin.json` | `<n>/.claude-plugin/plugin.json` (compat) | (skip) |

`<n>` = `<pluginsDir><pluginName>/`

## Architecture rules

- Source = canonical claude-style layout (commands/, agents/, skills/, rules/, hooks/, .mcp.json)
- For each source file: dispatch by top-level dir → check `Has<Capability>` on target → emit
- Translator uses capability's existing methods — **no duplication of transform logic**
- Skip emit if target lacks the capability (no `pluginAccepts` metadata)
- Hooks + mcp + plugin manifest: pass-through content (no frontmatter transform), path-mapped only

## Files to modify

| File | Change |
|---|---|
| `src/infrastructure/adapters/plugin-distribution-reader-adapter.ts` | whitelist rules/hooks/mcp.json; categorize new types |
| `src/domain/models/plugin-distribution.ts` | extend `PluginComponents`; rewrite `translateNative`; extend `translateFlat`; emit native manifest |
| `tests/domain/models/plugin-distribution-translate.unit.test.ts` | rewrite with real-translation assertions |
| `tests/application/use-cases/install/install-plugins-use-case.integration.test.ts` | adjust assertions if paths change for non-claude |
| `tests/application/use-cases/install/install-wizard-plugins.integration.test.ts` | same |
| `tests/application/use-cases/plugin/plugin-add-use-case.integration.test.ts` | same (claude paths likely unchanged) |
| `tests/application/use-cases/restore-plugin.integration.test.ts` | same |

## New fixtures (optional)

- `tests/fixtures/plugins/claude-format/full-plugin/` — plugin with all 6 components (commands, agents, skills, rules, hooks, mcp) for cross-format unit tests

## Acceptance criteria

| # | Criterion |
|---|---|
| AC1 | Reader ingests `rules/`, `hooks/hooks.json`, `.mcp.json` from plugin source |
| AC2 | claude src `agents/reviewer.md` → codex target → emits `<n>/agents/reviewer.toml` with TOML schema |
| AC3 | claude src `rules/foo.md` → cursor target → emits `<n>/rules/foo.mdc` with cursor frontmatter |
| AC4 | claude src `commands/foo.md` → copilot target → emits `<n>/prompts/foo.prompt.md` with copilot schema |
| AC5 | claude src plugin → claude target → unchanged paths (`<n>/commands/foo.md` etc.) |
| AC6 | hooks/mcp emitted only when target has matching capability |
| AC7 | Plugin manifest emitted at target's `pluginManifestRelativePath` |
| AC8 | Opencode flat mode emits agents/skills/rules in addition to commands, with namespace prefix |
| AC9 | Methods ≤ 20 lines per rule |
| AC10 | All existing tests pass after assertion updates |
| AC11 | Smoke agents (5 parallel /tmp dirs) re-validate full lifecycle |

## Out of scope

- Reverse-conversion (source format != claude) — defer; canonical assumption holds
- New plugin formats discovery — defer
- Marketplace flow (#261) — separate ticket

## Done when

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green
- 5 smoke agents PASS with real translation evidence (TOML for codex agents, .mdc for cursor rules, .prompt.md for copilot commands)
