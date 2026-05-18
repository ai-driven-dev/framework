# 02 - Scaffold plugin tree

Write the minimum directory tree and top-level files a plugin needs to load.

## Inputs

- `plugin_name`, `plugin_description`, `domain_type`, `artifact_set`, `location` from action 01.

## Outputs

```text
<plugins-root>/<plugin_name>/
  .claude-plugin/plugin.json
  README.md
  skills/               (if artifact_set.skills, mkdir only)
  agents/               (if artifact_set.agents, mkdir only)
  hooks/                (if artifact_set.hooks, mkdir only)
  .mcp.json             (if artifact_set.mcp, from template)
```

`<plugins-root>` is the host project's plugins directory when `location=local`,
or the user's global plugins directory when `location=global`.

## Depends on

- `01-capture-plugin-intent`

## Process

1. **Resolve `<plugins-root>`** from `location`. Refuse to write outside the user's known plugins surface.
2. **Refuse overwrite.** If `<plugins-root>/<plugin_name>/` already exists, abort with a clear message; this action never overwrites a plugin folder.
3. **Render `plugin.json`** by copying `@../../assets/plugins/plugin-template.json` and filling `name`, `version` (default `0.1.0`), `description`. For `author`: if the user supplied a value, use it; else read `git config user.name` and `git config user.email` in the host repo and populate `author: { name, email }` when both succeed; else drop the key. This eliminates the `claude plugin validate` "no author information" warning on the common case. Only `name` is required by the schema; drop any other field when no value (user-supplied or git-derived) is available. Full field reference: `@../../references/plugin-manifest.md`.
4. **Render `README.md`** by copying `@../../assets/plugins/plugin-readme-template.md` and substituting `{{plugin_name}}` and `{{plugin_description}}`.
5. **Create selected subdirs** (`skills/`, `agents/`, `hooks/` per `artifact_set`). Add a `.gitkeep` only if needed for the tooling the user uses.
6. **Write `.mcp.json`** from a minimal template if `artifact_set.mcp` is true. Empty `mcpServers: {}` map.

## Test

The directory `<plugins-root>/<plugin_name>/` exists; `claude plugin validate <plugins-root>/<plugin_name>` reports zero schema errors on `plugin.json`; the subdirs in `artifact_set` exist and only those.
