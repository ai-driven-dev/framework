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

Plugin manifest schemas diverge across tools in their required keys. This action uses per-tool manifest rendering driven by `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md` (each tool's Plugins section lists its required keys):

- **Claude Code**: `name` only required; `version`, `description`, `author` optional.
- **Cursor**: `name` only required; other fields optional.
- **Codex CLI**: `name`, `version`, `description` all required; component slot keys (`skills`, `agents`, `hooks`, `mcpServers`) must be relative paths starting with `./`.
- **GitHub Copilot**: `name` required (kebab-case, max 64 chars); standard plugin-manifest metadata optional.

For each confirmed tool, render `plugin.json` with that tool's required keys always populated and optional keys emitted only when the user supplied a value (or git-derived). Do not emit a key for another tool's required field - never invent keys not listed in `ai-mapping.md`.

## Process

1. **Resolve `<plugins-root>`** from `location`: when `location=local`, `<plugins-root>` = `<plugin_root>/` (CWD-relative, default `plugins/`). Refuse to write outside the user's known plugins surface.
2. **Refuse overwrite.** If `<plugins-root>/<plugin_name>/` already exists for any confirmed tool, abort with a clear message; this action never overwrites a plugin folder.
3. **For each confirmed (non-blocked) tool**, resolve the manifest directory from `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md` (`.claude-plugin/` for Claude Code, `.cursor-plugin/` for Cursor, `.codex-plugin/` for Codex CLI, plugin root for GitHub Copilot). Render `plugin.json` with only that tool's required fields plus any optional fields the user supplied. For `author`: if the user supplied a value, use it; else read `git config user.name` and `git config user.email` and populate `author: { name, email }` when both succeed; else drop the key.
4. **Render `README.md`** by copying `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/plugins/plugin-readme-template.md` and substituting `{{plugin_name}}` and `{{plugin_description}}`. One `README.md` per plugin tree (shared across tools when writing to the same directory; separate when paths diverge).
5. **Create selected subdirs** (`skills/`, `agents/`, `commands/`, `hooks/` per `artifact_set`). Add a `.gitkeep` only if needed for the tooling the user uses.
   - `commands/` is created for Claude Code, Cursor, and GitHub Copilot when `artifact_set.commands` is true.
   - `commands/` is SKIPPED for Codex CLI even if `artifact_set.commands` is true - Codex CLI does not support custom slash commands per `ai-mapping.md`; emit a note: "commands slot skipped for Codex CLI; use a skill instead if a reusable workflow is needed."
   - `commands/` is N/A for OpenCode (plugin is a single JS/TS module; OpenCode is D2-blocked per O1).
6. **Write `.mcp.json`** from a minimal template if `artifact_set.mcp` is true. Empty `mcpServers: {}` map.
7. **Post-write path check (MANDATORY).** After writing, MUST verify that every file in `files_written` satisfies BOTH:
   - the path is RELATIVE (no leading `/`), so it lives under the host's CWD (= workspace root); and
   - the path does NOT contain `${CLAUDE_PLUGIN_ROOT}` (would mean we wrote into the plugin install dir, which is read-only).
   If any path violates either invariant, FAIL with `status: bad_write_target: wrote to <actual-path>, expected a CWD-relative path under the workspace root`.

## Test

For each confirmed (non-blocked) tool, the manifest directory and `plugin.json` exist with that tool's required fields populated and no extra keys invented. The subdirs in `artifact_set` exist and only those. OpenCode is not written (D2 block from action 01). Each D2-blocked tool appears in `blocked_tools` with a non-empty reason.
