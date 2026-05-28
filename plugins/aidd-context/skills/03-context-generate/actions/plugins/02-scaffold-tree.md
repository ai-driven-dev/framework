# 02 - Scaffold plugin tree

Write the minimum directory tree and manifest files a plugin needs to load, for each confirmed tool.

## Inputs

- `plugin_name`, `plugin_description`, `domain_type`, `artifact_set`, `location`, `confirmed_tools`, `blocked_tools` from action 01.

## Outputs

One manifest tree per confirmed (non-blocked) tool:

```text
# Claude Code
<plugins-root>/<plugin_name>/
  .claude-plugin/plugin.json
  README.md
  skills/   agents/   commands/   hooks/   .mcp.json  (per artifact_set)

# Cursor
<plugins-root>/<plugin_name>/
  .cursor-plugin/plugin.json
  README.md
  ...

# Codex CLI
<plugins-root>/<plugin_name>/
  .codex-plugin/plugin.json
  README.md
  ...

# GitHub Copilot
<plugins-root>/<plugin_name>/
  plugin.json
  README.md
  ...
```

OpenCode is D2-blocked (O1): no manifest tree is written for it.

`<plugins-root>` is `<plugin_root>/` (CWD-relative) when `location=local` (default `plugins/`), or the user's global plugins directory when `location=global`. Never resolve `<plugins-root>` relative to the plugin install directory.

## Depends on

- `01-capture-plugin-intent`

## Manifest schema approach

For each confirmed (non-blocked) tool `<tool>`, copy the template under `@../../assets/plugins/<tool>/plugin-template.json` (where `<tool>` is: `claude`, `cursor`, `copilot`, `codex`; OpenCode is D2-blocked per O1), fill the `{{placeholders}}`, and write it to the manifest directory resolved from `@../../references/ai-mapping.md`. Required keys and optional keys are encoded in the per-tool template; emit optional keys only when the user supplied a value or the key is git-derived. Never invent keys not present in the template.

## Process

1. **Resolve `<plugins-root>`** from `location`: when `location=local`, `<plugins-root>` = `<plugin_root>/` (CWD-relative, default `plugins/`). Refuse to write outside the user's known plugins surface.
2. **Refuse overwrite.** If `<plugins-root>/<plugin_name>/` already exists for any confirmed tool, abort with a clear message; this action never overwrites a plugin folder.
3. **For each confirmed (non-blocked) tool**, resolve the manifest directory from `@../../references/ai-mapping.md` (hooks/plugins/marketplaces map). Copy `@../../assets/plugins/<tool>/plugin-template.json`, fill `{{placeholders}}` with required fields and any optional fields that are user-supplied or auto-derived below. Never guess a value: if a field cannot be supplied or derived, drop the key.
   - `author`: if the user supplied a value, use it; else read `git config user.name` and `git config user.email` and populate `author: { name, email }` when both succeed; else drop the key.
   - `repository`: derive from `git config --get remote.origin.url`, normalized to https (strip a trailing `.git`; convert `git@host:org/repo` to `https://host/org/repo`). Drop if no remote.
   - `homepage`: reuse the normalized `repository` URL unless the user supplied a distinct homepage. Drop if neither exists.
   - `license`: read the SPDX identifier from a top-level `LICENSE` or `LICENSE.md` (plugin root, else repo root) when detectable; else drop. Never infer a license.
4. **Render `README.md`** by copying `@../../assets/plugins/plugin-readme-template.md` and substituting `{{plugin_name}}` and `{{plugin_description}}`. One `README.md` per plugin tree (shared across tools when writing to the same directory; separate when paths diverge).
5. **Create selected subdirs** (`skills/`, `agents/`, `commands/`, `hooks/` per `artifact_set`). Add a `.gitkeep` only if needed for the tooling the user uses. For each confirmed tool, consult `@../../references/ai-mapping.md` to determine whether the `commands/` slot is supported; if the tool lists commands as unsupported, skip creating `commands/` and emit the note from `ai-mapping.md`. OpenCode is D2-blocked per O1 and never reaches this step.
6. **Write `.mcp.json`** from a minimal template if `artifact_set.mcp` is true. Empty `mcpServers: {}` map.
7. Apply the **write target validation** from `@../../references/tool-resolution.md` (## Write target validation).

## Test

```bash
# Test: each written plugin.json exists and parses as valid JSON
for path in "${files_written[@]}"; do
  test -f "$path" || exit 1
  node -e "JSON.parse(require('fs').readFileSync('$path','utf8'))" || exit 1
done
# Test: when a git remote exists, a lenient-schema manifest carries the derived repository
if git config --get remote.origin.url >/dev/null 2>&1; then
  grep -q '"repository"' "${files_written[0]}" || exit 1
fi
echo ok
```
