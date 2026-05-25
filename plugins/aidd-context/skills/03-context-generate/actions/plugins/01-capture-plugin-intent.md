# 01 - Capture plugin intent

Clarify what plugin the user wants before any file is touched.

## Inputs

- Free-form user request about creating a new plugin.

## Outputs

Decisions held in conversation context (not written to disk):

```yaml
plugin_name: <kebab-case, prefix-allowed (e.g. aidd-obs)>
plugin_description: <one-sentence; what capability the plugin exposes>
domain_type: tool | activity
artifact_set:
  skills: true | false
  agents: true | false
  commands: true | false
  hooks: true | false
  mcp: true | false
location: local | global
seed_skill:
  name: <kebab-case, optional>
  description: <one-sentence, optional>
confirmed_tools:
  - <tool id>   # e.g. claude-code, cursor, copilot, codex-cli
blocked_tools:
  - { tool: <id>, reason: <D2 explanation> }
```

Plus a **plugin landscape** report (existing plugins inventory + overlap alerts).

## Process

1. **Verify asset access.** Read `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md` AND `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/tool-resolution.md`. If EITHER read fails, returns empty content, or `${CLAUDE_PLUGIN_ROOT}` is not resolved by the host (resulting in a literal string Read attempt rather than absolute-path access), FAIL with `status: blocked_assets_unreachable: cannot read references via ${CLAUDE_PLUGIN_ROOT}. The aidd-context plugin is not properly installed in this AI host's runtime. Install it as a plugin (or ensure ${CLAUDE_PLUGIN_ROOT} resolves to the plugin install root) before running this action.` Do NOT proceed, do NOT invent a tool list, do NOT guess paths.
2. **Resolve target tools.** Follow `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/tool-resolution.md` (detect, propose, confirm 1..N). For each confirmed tool, look up the plugin manifest location in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`; if the cell is marked unsupported (e.g. OpenCode, per O1), apply the D2 block for that tool and record it in `blocked_tools`. Continue with the remaining supported tools.
3. **Inventory plugins.** For each confirmed (non-blocked) tool, iterate over the Plugin manifest column in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md` to resolve that tool's manifest location (e.g. `.claude-plugin/plugin.json` for Claude Code). Scan each location and print a merged markdown table: `tool`, `name`, `version`, first sentence of `description`. `ai-mapping.md` is the source of truth for manifest paths; do not hard-code them here.
4. **Ask the plugin's single purpose** in one sentence. If the purpose overlaps an existing plugin, propose merge, scope-tighten, or rename.
5. **Validate `plugin_name`** per `../../references/naming-conventions.md` (kebab-case, no spaces, prefix conventions like `aidd-` allowed when appropriate).
6. **Choose `domain_type`** (tool vs activity). Same rule as skills: tool = singular noun (`slack`); activity = action verb (`audit`).
7. **Pick `artifact_set`.** Ask which slots the plugin needs: skills (always at least one), agents (optional), commands (optional - slash commands bundled with the plugin), hooks (optional), MCP servers (optional). Empty plugins are blocked. Note: commands are supported by Claude Code, Cursor, and GitHub Copilot; Codex CLI does not support custom slash commands (D2); OpenCode is D2-blocked for plugins entirely (O1).
8. **Surface overlaps.** Same `plugin_name` already on disk for any confirmed tool -> block. Description trigger overlap with another plugin -> ask for resolution before continuing.
9. **Optionally collect a seed skill.** If the user names one, capture `seed_skill.name` and `seed_skill.description` so action 03 can delegate to the existing `actions/skills/` flow.

## Test

The plugin-intent decisions above are stated and confirmed by the user in writing; the existing-plugins inventory was shown across all confirmed tools' manifest locations (not only `.claude-plugin/`); every overlap was either resolved or explicitly noted "none"; `confirmed_tools` and `blocked_tools` are emitted; OpenCode is D2-blocked with the O1 rationale if it was detected.
