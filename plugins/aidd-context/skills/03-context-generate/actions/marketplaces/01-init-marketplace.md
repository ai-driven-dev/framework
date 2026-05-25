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

Resolved from `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`:

| Tool           | Marketplace file path                      | Supported |
| -------------- | ------------------------------------------ | --------- |
| Claude Code    | `.claude-plugin/marketplace.json`          | yes       |
| Cursor         | `.cursor-plugin/marketplace.json`          | yes       |
| Codex CLI      | `.agents/plugins/marketplace.json`         | yes       |
| OpenCode       | none                                       | no (D2)   |
| GitHub Copilot | none (settings-driven, no per-repo file)   | no (D2)   |

## Process

1. **Verify asset access.** Read `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md` AND `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/tool-resolution.md`. If EITHER read fails, returns empty content, or `${CLAUDE_PLUGIN_ROOT}` is not resolved by the host (resulting in a literal string Read attempt rather than absolute-path access), FAIL with `status: blocked_assets_unreachable: cannot read references via ${CLAUDE_PLUGIN_ROOT}. The aidd-context plugin is not properly installed in this AI host's runtime. Install it as a plugin (or ensure ${CLAUDE_PLUGIN_ROOT} resolves to the plugin install root) before running this action.` Do NOT proceed, do NOT invent a tool list, do NOT guess paths.
2. **Choose target scope.** Ask the user: "Write artifacts at the project root, or inside an existing/new plugin?"
   - `project root` (default) -- set `target_base = ""` (empty string). All write paths are CWD-relative literals, landing under the user's workspace root (the host MUST set CWD = workspace).
   - `plugin:<plugin-name>` -- set `target_base = "plugins/<plugin-name>/"`. Confirm the plugin dir exists or create it. All write paths are prepended with `target_base`.
   The action is BLOCKING on this answer. If no answer is received, FAIL with `status: blocked_awaiting_target_scope`.
3. **Resolve target tools.** Follow `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/tool-resolution.md` (detect, propose, confirm 1..N). For each confirmed tool, look up the marketplace surface in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`; if the cell is marked unsupported (OpenCode, GitHub Copilot), apply the D2 block and record it in `blocked_tools`. Continue with the remaining supported tools (Claude Code, Cursor, Codex CLI).
4. **Refuse overwrite.** For each confirmed (non-blocked) tool, if the marketplace file already exists, abort for that tool with a clear message and tell the user to use `@02-add-plugin-entry.md` instead. Continue with the remaining tools.
5. **Validate `marketplace_name`** against the reserved-name list in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/marketplace.md`. Block on match (exact or impersonation pattern).
6. **Write marketplace file.** For each confirmed (non-blocked) tool, pick the template based on the tool:
   - Claude Code and Cursor: use `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/marketplaces/marketplace-template.json`. Substitute `marketplace_name`, `owner_name`, `owner_email`, `description`, and `metadata.pluginRoot`. Drop optional keys not supplied.
   - Codex CLI: use `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/marketplaces/marketplace-codex-template.json`. Substitute `marketplace_name` into `name` and `description` into `interface.displayName`. Drop `interface.displayName` if no description was supplied. Do not emit `owner`, `metadata`, or `$schema` (not part of the Codex schema).

   Write to the `target_base`-prefixed CWD-relative path as resolved from the table above (e.g. `<target_base>.claude-plugin/marketplace.json`). Never write relative to the plugin install directory.
7. **Ensure `<plugin_root>` directory exists**; create it empty if missing.
8. Return all paths.
9. **Post-write path check (MANDATORY).** After writing, MUST verify that every file in `marketplace_files` satisfies ALL of the following:
   - the path is RELATIVE (no leading `/`), so it lives under the host's CWD (= workspace root); and
   - the path does NOT contain `${CLAUDE_PLUGIN_ROOT}` (would mean we wrote into the plugin install dir, which is read-only); and
   - if `target_scope = project root`: the path MUST NOT start with `plugins/<anything>/` (prevents accidental plugin writes); and
   - if `target_scope = plugin:<plugin-name>`: the path MUST start with `plugins/<plugin-name>/`.
   If any path violates any invariant, FAIL with `status: bad_write_target: wrote to <actual-path>, expected under <target_base>`.

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
