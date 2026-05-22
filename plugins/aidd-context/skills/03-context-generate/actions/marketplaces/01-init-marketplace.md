# 01 - Init marketplace

Scaffold a brand-new plugin marketplace (`.claude-plugin/marketplace.json`) at the repo root.

## Inputs

- `marketplace_name` (required) - kebab-case identifier shown to users on `/plugin install x@<marketplace_name>`. Must not be on the reserved list (checked in process step 2).
- `owner_name` (required) - string; the maintainer or team name.
- `owner_email` (optional) - contact email.
- `description` (optional) - one-sentence marketplace summary.
- `plugin_root` (optional, default `./plugins`) - base directory prepended to relative plugin sources (written to `metadata.pluginRoot`).

## Outputs

```yaml
marketplace_path: <repo-root>/.claude-plugin/marketplace.json
plugins_root: <repo-root>/<plugin_root>/
```

## Process

1. Refuse overwrite. If `<repo-root>/.claude-plugin/marketplace.json` already exists, abort with a clear message and tell the user to use `@02-add-plugin-entry.md` instead.
2. Validate `marketplace_name` against the reserved-name list in `@../../references/marketplace.md`. Block on match (exact or impersonation pattern).
3. Copy `@../../assets/marketplaces/marketplace-template.json` to `<repo-root>/.claude-plugin/marketplace.json` and substitute `marketplace_name`, `owner_name`, `owner_email`, `description`, `metadata.pluginRoot`. Drop optional keys that the user did not supply rather than emitting empty strings.
4. Ensure the `<plugin_root>` directory exists; create it empty if missing.
5. Return both paths.

## Test

`<repo-root>/.claude-plugin/marketplace.json` exists and validates via `claude plugin validate .` (or `/plugin validate .` inside AI tool) with zero errors; the `plugins` array is an empty `[]` ready for entries from `@02-add-plugin-entry.md`.
