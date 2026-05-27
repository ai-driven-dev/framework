---
objective: "Revert `${CLAUDE_PLUGIN_ROOT}` to relative paths in skill action markdown, references, and SKILL.md routers. Keep `${CLAUDE_PLUGIN_ROOT}` only where the host runtime substitutes it: hook configs, MCP configs, plugin manifests, marketplace catalogs."
success_condition: "After this work, `grep -rln 'CLAUDE_PLUGIN_ROOT' plugins/aidd-context/skills/` returns zero matches inside action markdown, references, and SKILL.md. The token only survives in `assets/hooks/*`, `assets/plugins/*`, `assets/marketplaces/*`, `assets/mcp/*`, and any file the framework GENERATES into the user's `.claude/settings.json` / MCP config / plugin manifests."
iteration: 0
created_at: 2026-05-27
source_research: deep search of 6 tools (Claude Code, VS Code Copilot, Copilot CLI, Cursor, OpenCode, Codex CLI, Mistral Vibe) on env-var resolution scope
execution_vehicle: "aidd-context:03:context-generate (refactor-skill mode)"
---

# Plan - Revert `${CLAUDE_PLUGIN_ROOT}` to relative paths in skill markdown

## Implementation deviation from the plan

The implementing commit 2484c98 also extracted three shared gates (asset access precheck, target scope selection, write target validation) into `tool-resolution.md ## Shared gates`, with the action files now calling the gates instead of inlining them. This was not part of the original M1-M4 scope. The extraction is a desirable R6 deduplication (eliminates ~100 repeated lines that the earlier R6-fold pass had already started) and was retained. Flagged here for traceability.

## Premise

Deep-research of 7 AI coding tools confirms: **`${CLAUDE_PLUGIN_ROOT}` is NOT expanded in skill action markdown by any documented host**. Expansion is scoped to hook command strings, MCP server config fields, and plugin manifest fields where the runtime spawns a process. Inside SKILL.md / action.md / reference.md / agent.md bodies, the token is a literal string the AI must interpret.

The Agent Skills spec at agentskills.io explicitly mandates "use relative paths from the skill root" for inter-file references. VS Code Copilot docs reinforce this with `[label](./path)` markdown links.

Our framework's adoption of `${CLAUDE_PLUGIN_ROOT}/skills/<n>/...` in action markdown was defensive engineering that bought zero cross-tool portability. It also doubled the average path length, hurt readability, and added a maintenance fork (the inline list of paths vs the source of truth in `ai-mapping.md`).

## Locked decisions

- **Action markdown, references, SKILL.md routers** → revert to relative paths. Two acceptable styles:
  - `@<relative>` (Claude `@`-import style, file-relative) for inline document references.
  - `[label](./path)` markdown links per the Agent Skills spec for content references inside skill instructions.
- **Generated artifacts** (hook configs in `.claude/settings.json`, MCP configs in `.mcp.json`, plugin manifests, marketplace catalogs) → KEEP `${CLAUDE_PLUGIN_ROOT}` where the runtime substitutes it (per the doc-verified support matrix).
- **Template assets** (the source files used to generate the above artifacts) → KEEP `${CLAUDE_PLUGIN_ROOT}` so the generated artifact carries the token to the runtime.

## Current state (audit)

`grep -rln 'CLAUDE_PLUGIN_ROOT' plugins/` returns **75 file matches** as of HEAD. Distribution:

| Category | Count | Decision |
|----------|-------|----------|
| Action markdown (`actions/**/*.md`) | ~20 files | **REVERT** to relative |
| SKILL.md routers | 6 files | **REVERT** to relative |
| References (`references/*.md`) | 3 files | **REVERT** to relative |
| Templates / assets | 0-2 files | **KEEP** (these generate config artifacts) |
| Tracked but not skill content (CHANGELOG, etc.) | residual | leave |

## Milestones

### M1 - Audit and classify

For every file containing `CLAUDE_PLUGIN_ROOT` under `plugins/aidd-context/`, classify each occurrence:
- (a) Path reference inside skill content (router, action, reference, prose docs) → REVERT
- (b) Path reference inside a template that becomes a generated config artifact (hook, MCP, plugin manifest, marketplace) → KEEP

Produce a table: file | line | string | decision (revert / keep). The table drives M2 mechanically.

### M2 - Mechanical revert

For each (revert) line:
- Replace `${CLAUDE_PLUGIN_ROOT}/skills/<this-skill>/<rest>` with the **file-relative** equivalent (`@<dots>/<rest>` where the dot count matches the action file's depth under the skill, or `@<rest>` from a SKILL.md / reference at the skill root).
- For cross-skill references (rare; should be near zero per the skill-auto-porteur rule), substitute the absolute env-var form with the duplicated local content already in place from earlier commits.

Conventions:
- From `actions/<sub>/01-X.md` (depth 2): `@../../<rest>`.
- From `actions/01-X.md` (depth 1): `@../<rest>`.
- From SKILL.md (root): `@<rest>`.
- From `references/X.md` (root): `@<rest>`.

### M3 - Verify generated-artifact templates untouched

Confirm none of the following lost their `${CLAUDE_PLUGIN_ROOT}`:
- `plugins/aidd-context/skills/03-context-generate/assets/hooks/hooks-template.json`
- `plugins/aidd-context/skills/03-context-generate/assets/plugins/plugin-template.json`
- `plugins/aidd-context/skills/03-context-generate/assets/marketplaces/plugin-entry-template.json`
- `plugins/aidd-context/skills/03-context-generate/assets/marketplaces/marketplace-template.json` and `marketplace-codex-template.json`
- Any MCP-server-config template if present.

These files contain the token deliberately - the AI copies them verbatim into the user's `.claude/settings.json` / `.mcp.json` / etc., where the host runtime DOES expand the token.

### M4 - Update SKILL.md path-convention notes

`tool-resolution.md` (and any reference that documents the path convention) currently says paths can be `${CLAUDE_PLUGIN_ROOT}/...`. Update to state the actual convention:

> Inside skill content (SKILL.md, action.md, reference.md), use relative paths from the file's location (`@../assets/X` from an action file, `@assets/X` from SKILL.md). `${CLAUDE_PLUGIN_ROOT}` survives only in generated configuration artifacts (hooks, MCP servers, plugin manifests, marketplace catalogs) where the host runtime substitutes it at process-spawn time.

### M5 - Re-run Claude E2E to confirm no regression

Spawn the same E2E suite as the last full test pass (02-project-init full + modify + fallback; 03-context-generate skills + rules + commands + agents + hooks + plugins + marketplaces). Verify:
- All `@` references resolve when Claude follows the action files.
- Generated artifacts (hook settings.json, MCP configs, plugin manifests) still carry `${CLAUDE_PLUGIN_ROOT}` and the host substitutes correctly at runtime.

### M6 - Update PR description

Edit PR #155 description to reflect the revised path convention and document the runtime-substitution boundary. Note in the PR: "Relative paths inside skill content; `${CLAUDE_PLUGIN_ROOT}` only in generated artifacts where the host runtime substitutes."

## Open questions (resolve in M1)

### O1 - Cross-skill content that was duplicated by the strict skill-auto-porteur rule

Earlier commits duplicated `ai-mapping.md`, `plan-template.md`, `1-command-structure.md` into consumer skills under the "skill auto-porteur strict" decision. Their absolute-path forms (`${CLAUDE_PLUGIN_ROOT}/skills/<other-skill>/...`) are gone because the content moved local. After revert, the surviving local copies are referenced via `@<relative>` - no env var needed. Verify nothing slipped through.

### O2 - Cross-plugin references

If any file in `aidd-context/` still references something in `aidd-dev/` or another plugin via `${CLAUDE_PLUGIN_ROOT}/../../aidd-dev/...`-style absolute form, decide:
- (a) Replace with a local copy (strict skill-auto-porteur, already the policy).
- (b) Accept the cross-plugin dependency and keep the absolute form (admits the framework runs in Claude Code only for that path).

Default lean: (a), consistent with the existing policy.

## Risks / constraints

- **R6 (zero duplication) reinforcement**: this revert is in the same direction as the recent R6-fold cleanup. Action files become shorter. No risk of new duplication.
- **Claude Code behavior**: Claude Code does NOT expand `${CLAUDE_PLUGIN_ROOT}` inside skill markdown either (per the open issue #9354). So Claude was also resolving the token by interpreting the string - relative paths are strictly closer to documented behavior.
- **Generated artifacts unchanged**: the user-facing output (the rule file Copilot reads, the hook script settings.json invokes) is unaffected by this revert. Only the framework's authoring layer changes.
- **R4 budget**: SKILL.md and action files shrink - well within the 500-line ceiling.

## Files touched (estimate)

- ~20 action files (`actions/**/*.md` in `aidd-context/skills/`)
- 6 SKILL.md routers (skills 00..05 of `aidd-context`)
- 3 references (`tool-resolution.md`, `ai-mapping.md`, `hook.md`)
- 0-2 template assets (audit confirms these stay)

## Acceptance

- `grep -rln 'CLAUDE_PLUGIN_ROOT' plugins/aidd-context/skills/*/actions/ plugins/aidd-context/skills/*/references/ plugins/aidd-context/skills/*/SKILL.md` returns ZERO matches.
- Templates in `plugins/aidd-context/skills/*/assets/` use `{{command}}` placeholders that the AI populates during generation; no literal `CLAUDE_PLUGIN_ROOT` survives in tracked source. The only surviving literal in the plugin is `plugins/aidd-context/hooks/hooks.json` (the plugin's runtime hook config, outside the skills tree).
- Claude E2E re-test passes the same matrix that passed at HEAD.
- PR #155 description updated.
