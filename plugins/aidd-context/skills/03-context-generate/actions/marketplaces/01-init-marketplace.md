# 01 - Init marketplace

Scaffold a brand-new plugin marketplace file at the repo root, for each confirmed tool that supports a marketplace.

## Inputs

- `marketplace_name` (required) - kebab-case identifier. Must not be on the reserved list (checked in process step 3).
- `owner_name` (required) - string; the maintainer or team name.
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
plugins_root: <repo-root>/<plugin_root>/
```

## Marketplace paths per tool

Resolved from `@../../references/ai-mapping.md`:

| Tool           | Marketplace file path                          | Supported |
| -------------- | ---------------------------------------------- | --------- |
| Claude Code    | `<repo-root>/.claude-plugin/marketplace.json`  | yes       |
| Cursor         | `<repo-root>/.cursor-plugin/marketplace.json`  | yes       |
| Codex CLI      | `<repo-root>/.agents/plugins/marketplace.json` | yes       |
| OpenCode       | none                                           | no (D2)   |
| GitHub Copilot | none (settings-driven, no per-repo file)       | no (D2)   |

## Process

1. **Resolve target tools.** Follow `@../../references/tool-resolution.md` (detect, propose, confirm 1..N). For each confirmed tool, look up the marketplace surface in `@../../references/ai-mapping.md`; if the cell is marked unsupported (OpenCode, GitHub Copilot), apply the D2 block and record it in `blocked_tools`. Continue with the remaining supported tools (Claude Code, Cursor, Codex CLI).
2. **Refuse overwrite.** For each confirmed (non-blocked) tool, if the marketplace file already exists, abort for that tool with a clear message and tell the user to use `@02-add-plugin-entry.md` instead. Continue with the remaining tools.
3. **Validate `marketplace_name`** against the reserved-name list in `@../../references/marketplace.md`. Block on match (exact or impersonation pattern).
4. **Write marketplace file.** For each confirmed (non-blocked) tool, pick the template based on the tool:
   - Claude Code and Cursor: use `@../../assets/marketplaces/marketplace-template.json`. Substitute `marketplace_name`, `owner_name`, `owner_email`, `description`, and `metadata.pluginRoot`. Drop optional keys not supplied.
   - Codex CLI: use `@../../assets/marketplaces/marketplace-codex-template.json`. Substitute `marketplace_name` into `name` and `description` into `interface.displayName`. Drop `interface.displayName` if no description was supplied. Do not emit `owner`, `metadata`, or `$schema` (not part of the Codex schema).

   Write to the path resolved in step 1.
5. **Ensure `<plugin_root>` directory exists**; create it empty if missing.
6. Return all paths.

## Test

For each confirmed (non-blocked) tool, the marketplace file exists at the tool's resolved path and the `plugins` array is an empty `[]` ready for entries from `@02-add-plugin-entry.md`. OpenCode and GitHub Copilot are D2-blocked with a non-empty reason. Claude Code marketplace validates via `claude plugin validate .` with zero errors.
