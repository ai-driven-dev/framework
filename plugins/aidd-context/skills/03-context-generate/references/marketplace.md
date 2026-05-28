# Claude Code plugin marketplace (deep reference, `marketplace.json`)

Lives at `<repo-root>/.claude-plugin/marketplace.json`. Validated by `claude plugin validate <dir>` or `/plugin validate .`.

## Required

- `name` (string, min 1) - public marketplace identifier; users see it in `/plugin install <plugin>@<name>`.
- `owner` (object) - `name` required; `email`, `url` optional.
- `plugins` (array) - one entry per plugin (see below).

## Optional root fields

| Field                                 | Type             | Notes                                                                       |
| ------------------------------------- | ---------------- | --------------------------------------------------------------------------- |
| `$schema`                             | string           | Ignored at load time; enables editor autocomplete.                          |
| `version`                             | string           | Marketplace manifest version.                                               |
| `description`                         | string           | One-sentence summary.                                                       |
| `forceRemoveDeletedPlugins`           | boolean          | Auto-uninstall plugins removed from the catalog.                            |
| `metadata`                            | object           | `pluginRoot` (base dir prepended to relative sources), `version`, `description`. |
| `allowCrossMarketplaceDependenciesOn` | array of strings | Other marketplaces whose plugins may be auto-installed as dependencies.     |

## Plugin entry

Each item of `plugins[]`. Shape is a superset of the plugin manifest plus marketplace-specific fields.

### Required

- `name` (string, min 1) - kebab-case, matches the plugin's own `plugin.json` `name`.
- `source` - one of the source shapes below.

### Marketplace-specific optional

| Field      | Type             | Notes                                                                |
| ---------- | ---------------- | -------------------------------------------------------------------- |
| `category` | string           | Free-form grouping label.                                            |
| `tags`     | array of strings | Search/discovery tags.                                               |
| `strict`   | boolean          | Default `true`. `true` = the plugin's own `plugin.json` is the authority and the entry only supplements; `false` = the entry is the entire definition. |

### Inherited from plugin manifest

`version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `dependencies`, `hooks`, `commands`, `agents`, `skills`, `outputStyles`, `themes`, `channels`, `mcpServers`, `lspServers`, `monitors`, `settings`, `userConfig`.

## Source shapes

| Shape             | Required keys                | Optional keys     | Notes                                                                 |
| ----------------- | ---------------------------- | ----------------- | --------------------------------------------------------------------- |
| Relative path     | string starting with `./`    | -                 | Resolves relative to the marketplace root (the directory containing `.claude-plugin/`). No `..` segments allowed. Git-hosted marketplaces only. |
| `npm`             | `source: "npm"`, `package`   | `version`, `registry` (URI) | Installed via `npm install`.                                  |
| `url`             | `source: "url"`, `url`       | `ref`, `sha`      | Generic git URL.                                                      |
| `github`          | `source: "github"`, `repo`   | `ref`, `sha`      | `repo` is `owner/name`. `sha` is full 40-char hex.                    |
| `git-subdir`      | `source: "git-subdir"`, `url`, `path` | `ref`, `sha` | Plugin lives in a subdirectory; uses sparse clone.                    |

## Version resolution

A plugin's effective version comes from the first that is set:

1. `version` in the plugin's own `plugin.json`.
2. `version` in the marketplace entry.
3. The git commit SHA of the plugin source.

Pinning `version` while pushing new commits without bumping the field results in users keeping the cached copy. Omit `version` to let the commit SHA drive updates.

## Reserved marketplace names

These names are reserved and rejected at validation:

`claude-code-marketplace`, `claude-code-plugins`, `claude-plugins-official`, `anthropic-marketplace`, `anthropic-plugins`, `agent-skills`, `knowledge-work-plugins`, `life-sciences`.

Names that impersonate official marketplaces (e.g. `official-claude-plugins`, `anthropic-tools-v2`) are also blocked.
