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

1. Load the tool's marketplace file path (from `@../../references/ai-mapping.md`). Parse JSON; abort for that tool if invalid.
2. Verify no entry with the same `plugin_name` already exists. If yes, ask whether to replace or skip; never silently overwrite.
3. For each confirmed (non-blocked) tool `<tool>`, build the entry by copying `@../../assets/marketplaces/<tool>/plugin-entry-template.json` (where `<tool>` is: `claude`, `cursor`, `copilot`, `codex`) using only the fields the user supplied (shape rules: `@../../references/marketplace.md`). Drop any empty optional fields rather than emitting `null`.
4. For relative-path sources, verify the target directory exists (CWD-relative) and contains the tool's expected manifest file (e.g. `.claude-plugin/plugin.json` for Claude Code, `.cursor-plugin/plugin.json` for Cursor, `.codex-plugin/plugin.json` for Codex CLI). For `github` / `url` / `git-subdir` / `npm` sources, no local check.
5. Append the entry to the `plugins` array. Write the file back with stable 2-space indentation.
6. Return the rendered entry and the new `plugin_count` per tool.
7. Apply the **write target validation** from `@../../references/tool-resolution.md` (## Write target validation).

## Test

```bash
# Test: each marketplace file parses as JSON and contains the new plugin_name in plugins[]
for entry in "${per_tool[@]}"; do
  path="${marketplace_files[${entry[tool]}]}"
  test -f "$path" || exit 1
  node -e "const m=JSON.parse(require('fs').readFileSync('$path','utf8')); if (!m.plugins.some(p=>p.name==='${plugin_name}')) process.exit(1);" || exit 1
done
echo ok
```
