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

1. **Resolve target tools.** Follow `@../../references/tool-resolution.md` (detect, propose, confirm 1..N). For each confirmed tool, look up the plugin manifest location in `@../../references/ai-mapping.md`; if the cell is marked unsupported (e.g. OpenCode, per O1), apply the D2 block for that tool and record it in `blocked_tools`. Continue with the remaining supported tools.
2. **Inventory plugins.** For each confirmed (non-blocked) tool, scan the tool's manifest location (resolved from `@../../references/ai-mapping.md`): `.claude-plugin/plugin.json` for Claude Code, `.cursor-plugin/plugin.json` for Cursor, `.codex-plugin/plugin.json` for Codex CLI, `plugin.json` at plugin root for GitHub Copilot. Print a merged markdown table: `tool`, `name`, `version`, first sentence of `description`.
3. **Ask the plugin's single purpose** in one sentence. If the purpose overlaps an existing plugin, propose merge, scope-tighten, or rename.
4. **Validate `plugin_name`** per `../../references/naming-conventions.md` (kebab-case, no spaces, prefix conventions like `aidd-` allowed when appropriate).
5. **Choose `domain_type`** (tool vs activity). Same rule as skills: tool = singular noun (`slack`); activity = action verb (`audit`).
6. **Pick `artifact_set`.** Ask which slots the plugin needs: skills (always at least one), agents (optional), hooks (optional), MCP servers (optional). Empty plugins are blocked.
7. **Surface overlaps.** Same `plugin_name` already on disk for any confirmed tool -> block. Description trigger overlap with another plugin -> ask for resolution before continuing.
8. **Optionally collect a seed skill.** If the user names one, capture `seed_skill.name` and `seed_skill.description` so action 03 can delegate to the existing `actions/skills/` flow.

## Test

The plugin-intent decisions above are stated and confirmed by the user in writing; the existing-plugins inventory was shown across all confirmed tools' manifest locations (not only `.claude-plugin/`); every overlap was either resolved or explicitly noted "none"; `confirmed_tools` and `blocked_tools` are emitted; OpenCode is D2-blocked with the O1 rationale if it was detected.
