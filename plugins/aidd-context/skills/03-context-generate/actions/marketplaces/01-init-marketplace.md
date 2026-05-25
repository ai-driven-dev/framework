# 01 - Init marketplace

Scaffold a brand-new plugin marketplace file at `<project_root>`, for each confirmed tool that supports a marketplace.

## Inputs

- `marketplace_name` (required) - kebab-case identifier. Must not be on the reserved list (checked in process step 3).
- `owner_name` (required) - string; the maintainer or team name.
- `project_root` (required) - absolute path of the user's VS Code workspace (NOT the plugin install location). Resolve from `${workspaceFolder}` in Copilot, `${CLAUDE_PROJECT_DIR}` in Claude Code, or the equivalent host variable.
- `owner_email` (optional) - contact email.
- `description` (optional) - one-sentence marketplace summary.
- `plugin_root` (optional, default `./plugins`) - base directory prepended to relative plugin sources.

## Outputs

```yaml
confirmed_tools:
  - <tool id>
blocked_tools:
  - { tool: <id>, reason: <D2 explanation> }
marketplace_files:
  - { tool: <id>, path: <marketplace file path> }
plugins_root: <project_root>/<plugin_root>/
```

## Marketplace paths per tool

Resolved from `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`:

| Tool           | Marketplace file path                          | Supported |
| -------------- | ---------------------------------------------- | --------- |
| Claude Code    | `<project_root>/.claude-plugin/marketplace.json`  | yes       |
| Cursor         | `<project_root>/.cursor-plugin/marketplace.json`  | yes       |
| Codex CLI      | `<project_root>/.agents/plugins/marketplace.json` | yes       |
| OpenCode       | none                                           | no (D2)   |
| GitHub Copilot | none (settings-driven, no per-repo file)       | no (D2)   |

## Process

1. **Verify asset access.** Read `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md` AND `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/tool-resolution.md`. If EITHER read fails, returns empty content, or `${CLAUDE_PLUGIN_ROOT}` is not resolved by the host (resulting in a literal string Read attempt rather than absolute-path access), FAIL with `status: blocked_assets_unreachable: cannot read references via ${CLAUDE_PLUGIN_ROOT}. The aidd-context plugin is not properly installed in this AI host's runtime. Install it as a plugin (or ensure ${CLAUDE_PLUGIN_ROOT} resolves to the plugin install root) before running this action.` Do NOT proceed, do NOT invent a tool list, do NOT guess paths.
2. **Resolve target tools.** Follow `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/tool-resolution.md` (detect, propose, confirm 1..N). For each confirmed tool, look up the marketplace surface in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`; if the cell is marked unsupported (OpenCode, GitHub Copilot), apply the D2 block and record it in `blocked_tools`. Continue with the remaining supported tools (Claude Code, Cursor, Codex CLI).
3. **Refuse overwrite.** For each confirmed (non-blocked) tool, if the marketplace file already exists, abort for that tool with a clear message and tell the user to use `@02-add-plugin-entry.md` instead. Continue with the remaining tools.
4. **Validate `marketplace_name`** against the reserved-name list in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/marketplace.md`. Block on match (exact or impersonation pattern).
5. **Write marketplace file.** For each confirmed (non-blocked) tool, pick the template based on the tool:
   - Claude Code and Cursor: use `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/marketplaces/marketplace-template.json`. Substitute `marketplace_name`, `owner_name`, `owner_email`, `description`, and `metadata.pluginRoot`. Drop optional keys not supplied.
   - Codex CLI: use `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/marketplaces/marketplace-codex-template.json`. Substitute `marketplace_name` into `name` and `description` into `interface.displayName`. Drop `interface.displayName` if no description was supplied. Do not emit `owner`, `metadata`, or `$schema` (not part of the Codex schema).

   Write to `<project_root>/<relative-marketplace-path>` as resolved from the table above. Never write relative to the plugin install directory.
6. **Ensure `<plugin_root>` directory exists**; create it empty if missing.
7. Return all paths.

## Test

For each confirmed (non-blocked) tool, the marketplace file exists at the tool's resolved path and the `plugins` array is an empty `[]` ready for entries from `@02-add-plugin-entry.md`. OpenCode and GitHub Copilot are D2-blocked with a non-empty reason. Claude Code marketplace validates via `claude plugin validate .` with zero errors.
