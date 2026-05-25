# 02 - Add plugin entry

Append a plugin entry to the marketplace file for each confirmed tool.

## Inputs

- `marketplace_files` (required) - from `@01-init-marketplace.md`, or existing paths the user provides (one per tool).
- `confirmed_tools`, `blocked_tools` (from `@01-init-marketplace.md`).
- `plugin_name` (required) - kebab-case plugin identifier, matches the plugin's own manifest `name`.
- `source` (required) - relative path (`./...`), or one of the object shapes `github` / `url` / `git-subdir` / `npm`.
- `description` (optional) - one-sentence plugin summary; falls back to the plugin's own manifest description.
- `version` (optional) - pin string. Omit to let the commit SHA drive updates.
- `category`, `tags`, `strict` (optional) - marketplace-specific fields.
- `author`, `homepage`, `repository`, `license`, `keywords`, `dependencies` (optional) - standard plugin-manifest metadata.

## Outputs

```yaml
per_tool:
  - tool: <id>
    plugin_entry: <the rendered JSON object>
    plugin_count: <integer; total entries in plugins[] after append>
```

## Depends on

- `01-init-marketplace` (or existing marketplace files per tool)

## Process

For each confirmed (non-blocked) tool from `marketplace_files`:

1. Load the tool's marketplace file path (from `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`). Parse JSON; abort for that tool if invalid.
2. Verify no entry with the same `plugin_name` already exists. If yes, ask whether to replace or skip; never silently overwrite.
3. Build the entry from `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/marketplaces/plugin-entry-template.json` using only the fields the user supplied (shape rules: `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/marketplace.md`). Apply any tool-specific schema difference noted in `ai-mapping.md` (e.g. Codex CLI schema uses `{ name, interface: { displayName }, plugins: [...] }` with `source.source` and `policy` fields). Drop any empty optional fields rather than emitting `null`.
4. For relative-path sources, verify the target directory exists (CWD-relative) and contains the tool's expected manifest file (e.g. `.claude-plugin/plugin.json` for Claude Code, `.cursor-plugin/plugin.json` for Cursor, `.codex-plugin/plugin.json` for Codex CLI). For `github` / `url` / `git-subdir` / `npm` sources, no local check.
5. Append the entry to the `plugins` array. Write the file back with stable 2-space indentation.
6. Return the rendered entry and the new `plugin_count` per tool.

## Test

For each confirmed (non-blocked) tool, the new entry is present in the tool's marketplace file `plugins[]`; for a Claude Code marketplace, `claude plugin validate .` reports zero errors; for a relative-path source, the tool's expected manifest file resolves under the CWD-relative `<source>/` path.
