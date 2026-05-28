# 01 - Init marketplace

Scaffold a brand-new plugin marketplace file, for each confirmed tool that supports a marketplace.

## Inputs

- `marketplace_name` (required) - kebab-case identifier. Must not be on the reserved list (checked in process step 5).
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
plugins_root: <plugin_root>/
target_scope: project_root | plugin:<plugin-name>
target_base: "" | "plugins/<plugin-name>/"
```

## Marketplace paths per tool

Resolve each tool's marketplace file path and its supported / D2-blocked status from the hooks/plugins/marketplaces map in `@../../references/ai-mapping.md`. Do not hardcode tool specifics here.

## Process

1. Apply the **asset-access precheck** from `@../../references/tool-resolution.md` (## Asset access precheck).
2. Apply the **target scope selection** from `@../../references/tool-resolution.md` (## Target scope selection).
3. **Resolve target tools.** Follow `@../../references/tool-resolution.md` (detect, propose, confirm 1..N). For each confirmed tool, look up the marketplace surface in `@../../references/ai-mapping.md`; if the cell is marked unsupported (OpenCode only), apply the D2 block and record it in `blocked_tools`. Continue with the remaining supported tools (Claude Code, Cursor, Codex CLI, GitHub Copilot).
4. **Refuse overwrite.** For each confirmed (non-blocked) tool, if the marketplace file already exists, abort for that tool with a clear message and tell the user to use `@02-add-plugin-entry.md` instead. Continue with the remaining tools.
5. **Validate `marketplace_name`** against the reserved-name list in `@../../references/marketplace.md`. Block on match (exact or impersonation pattern).
6. **Write marketplace file.** For each confirmed (non-blocked) tool `<tool>`, copy the template under `@../../assets/marketplaces/<tool>/marketplace-template.json` (where `<tool>` is: `claude`, `cursor`, `copilot`, `codex`), fill the `{{placeholders}}` with `marketplace_name`, `owner_name`, `owner_email`, `description`, and any other fields the template exposes. Drop optional keys not supplied, then drop any optional container object left empty by that pruning (e.g. an unused `metadata` or `interface`); never emit an empty `{}` object. Write to the `target_base`-prefixed CWD-relative path resolved from `@../../references/ai-mapping.md` for that tool. Never write relative to the plugin install directory.
7. **Ensure `<plugin_root>` directory exists**; create it empty if missing.
8. Return all paths.
9. Apply the **write target validation** from `@../../references/tool-resolution.md` (## Write target validation). Use `marketplace_files` as the file list.

## Test

```bash
# Test: each marketplace file exists, parses as JSON, has empty plugins array, and respects target_scope
for entry in "${marketplace_files[@]}"; do
  path="${entry[path]}"
  test -f "$path" || exit 1
  node -e "const m=JSON.parse(require('fs').readFileSync('$path','utf8')); if (!Array.isArray(m.plugins)||m.plugins.length!==0) process.exit(1);" || exit 1
  case "$target_scope" in
    project_root)
      [[ "$path" != plugins/* ]] || exit 1 ;;
    plugin:*)
      [[ "$path" == "$target_base"* ]] || exit 1 ;;
  esac
done
echo ok
```
