# AIDD CLI

`@ai-driven-dev/cli` (`aidd`) installs the framework into a project and keeps it in a known state.

| | |
| --- | --- |
| AI tools | Claude Code, Cursor, GitHub Copilot, Codex, OpenCode, Kilo Code |
| IDE | VS Code |
| Requires | Node.js 22.12 or later |
| Requires for marketplace plugins | `git` |

Every file it writes is hash-tracked in a manifest.
Drift is detected, and owned files can be restored.

## Install

| How | Run |
| --- | --- |
| Without installing | `npx @ai-driven-dev/cli@latest setup` |
| Once, for every project | `npm install -g @ai-driven-dev/cli@latest` |

Check: `aidd --version`.

## Quick start

| Step | Run |
| --- | --- |
| Bootstrap the project | `aidd setup --ai claude --ide vscode --plugins recommended --yes` |
| Add a plugin | `aidd plugin install aidd-dev` |
| Check the state | `aidd doctor` |
| Restore owned files | `aidd sync` |
| Update the CLI | `aidd update` |

`setup` writes the manifest, the default marketplace, the tool configs and the plugins.

## Commands

Every flag: `aidd --help`, then a group's own `--help`.

### Project

| Command | Does |
| --- | --- |
| `aidd setup` | Bring the whole project to a correct state: marketplace, tool configs, plugins |
| `aidd doctor` | Report detected tools, installed plugins, drift, and the fix for each |
| `aidd sync` | Rewrite owned files from the manifest, then re-drive native activation |
| `aidd clean` | Remove every AIDD-managed file from the project |
| `aidd update` | Update the CLI itself (alias `upgrade`) |

### Framework

| Command | Does |
| --- | --- |
| `aidd framework install` | Write one tool's runtime configuration from the bundled assets |
| `aidd framework update` | Move installed tools to this CLI's assets (all of them without `--tool`) |
| `aidd framework remove` | Delete the generated configuration files of one tool |
| `aidd framework rules` | List the rules installed across every AI tool (`--json` for a machine) |

### Plugins

| Command | Does |
| --- | --- |
| `aidd plugin install` | Install a plugin by marketplace name, by local path, or by interactive pick |
| `aidd plugin list` | List installed plugins for one tool or all of them |
| `aidd plugin update` | Move one plugin, or every plugin, to the catalog's current version |
| `aidd plugin remove` | Uninstall a plugin from one tool or all of them |
| `aidd plugin search` | Search registered marketplaces (`--recommended` for the curated set) |

### Marketplaces

| Command | Does |
| --- | --- |
| `aidd marketplace add` | Register a marketplace by name and source |
| `aidd marketplace list` | List registered marketplaces (`--plugins` also prints their catalogs) |
| `aidd marketplace refresh` | Re-fetch catalogs (`--force` clears the cache first) |
| `aidd marketplace check` | Report stale catalogs and plugins removed upstream |
| `aidd marketplace remove` | Unregister a marketplace and offer to clean its orphans |

### Authentication

| Command | Does |
| --- | --- |
| `aidd auth login` | Store a credential (`--token <value>` or `--gh`) |
| `aidd auth status` | Show which credential resolves, from where, at which level |
| `aidd auth logout` | Delete the stored credential |

### Measurement

Counts the tokens of Claude Code and Codex sessions, locally. Details: [FAQ](../docs/FAQ.md#measurement).

| Command | Does |
| --- | --- |
| `aidd telemetry on` | Measure this clone |
| `aidd telemetry off` | Stop measuring this clone. What was measured stays |
| `aidd telemetry status` | Show if this clone is measured, since when, and its task |
| `aidd telemetry task` | Declare the task the current work belongs to |
| `aidd telemetry ingest` | Read new transcripts into the local ledger |
| `aidd telemetry report` | Show what the work consumed, along one axis |
| `aidd telemetry identity` | Choose to be named on your own measurement, or show or remove that choice |
| `aidd telemetry forget` | Show everything measurement keeps, or remove it with `--yes` |

## Scope

`setup`, `doctor`, `sync` and `clean` accept `--scope <project|user>`.

| Scope | Acts on |
| --- | --- |
| `project` (default) | This project alone |
| `user` | The machine: registers the framework source and supported tools, writes nothing under the project |

`setup --scope user` needs:

- An explicit `--ai` list of supported tools (`--ai all` is refused).
- `--plugins none`, or no `--plugins` in a scripted run.
- No `--ide`.

| Tool | `setup --scope user` |
| --- | --- |
| `claude`, `codex`, `copilot` | Registers the source and drives the tool's own CLI |
| `cursor` | Records the source and tool only, no native activation |
| `opencode`, `kilo` | Unsupported: use project scope |

Native activation needs the tool's executable on `PATH`.
Without it, registration succeeds with a warning and activation stays unrun.
Install it, then run `aidd sync --scope user`.

```sh
aidd setup --scope user --ai claude,codex,copilot --plugins none --yes
```

## Authentication

Needed for a private marketplace only.

| Method | Stored in `auth.json` | Set with |
| --- | --- | --- |
| `stored` | The token itself | `--token <value>` |
| `external` | The provider name. The token is asked from it at fetch time | `--gh` |

The token resolves from the first hit:

1. `AIDD_TOKEN`
2. The project file `.aidd/auth.json`
3. The user file `auth.json` in the user config directory

| Option | Effect |
| --- | --- |
| `aidd auth login --level project` | Writes the project file |
| `aidd auth login --level user` | Writes the user file |
| `--token <value>` on `plugin install` or `marketplace add` | Passes a token for one call, stores nothing |

## Translate

`aidd translate <source> --to <tool> --out <dir>` converts a framework source tree into a target-native plugin tree.

- It records nothing in the manifest, unlike `aidd sync`.
- It is the author-side command: it produces what consumers install.

| `--as` | Output |
| --- | --- |
| `marketplace` (default) | A self-contained marketplace tree, registered with `aidd marketplace add` |
| `flat` | Plugin content straight under the tool's workspace directory, no marketplace step. `--force` overwrites existing files |

| Target | `marketplace` | `flat` | Workspace directory |
| --- | --- | --- | --- |
| `claude` | yes | yes | `.claude/` |
| `cursor` | yes | yes | `.cursor/` |
| `copilot` | yes | yes | `.github/` |
| `codex` | yes | yes | `.codex/` |
| `opencode` | no | yes | `.opencode/` |
| `kilo` | no | yes | `.kilo/` |

## Environment variables

| Variable | Effect |
| --- | --- |
| `AIDD_TOKEN` | Token for every fetch, ahead of any stored credential |
| `AIDD_USER_CONFIG_DIR` | Relocates the user config directory, credentials included |
| `XDG_CONFIG_HOME` | Names the config root when `AIDD_USER_CONFIG_DIR` is unset |
| `AIDD_SKIP_UPDATE_CHECK` | `1` skips the self-update check before a command |

## Where things live

### In the project

| Path | Holds |
| --- | --- |
| `.aidd/manifest.json` | Every owned file and its hash |
| `.aidd/config.json` | A git-tracked file `clean` never removes |
| `.aidd/auth.json` | The project-level credential |
| `.aidd/marketplaces.json` | Marketplaces registered at project scope |
| `.aidd/cache/`, `.aidd/plugin-cache/` | Fetched catalogs, built trees, plugin sources |

### On the machine

Under `$AIDD_USER_CONFIG_DIR`, else `$XDG_CONFIG_HOME/aidd`, else `~/.config/aidd`.

| Path | Holds |
| --- | --- |
| `auth.json` | The user-level credential |
| `marketplaces.json` | The user-scope registry |
| `references.json` | The projects claiming it |
| `manifest.json` | What `--scope user` owns |
| `cache/built/<version>/` | One built tree per CLI version |

### Settings written per tool

| Tool | File |
| --- | --- |
| Claude Code | `.claude/settings.json`, MCP servers in `.mcp.json` |
| Cursor | `.cursor/settings.json`, MCP servers in `.cursor/mcp.json` |
| GitHub Copilot | `.github/copilot/settings.json`, MCP servers in `.vscode/mcp.json`, plus `.vscode/settings.json` when the VS Code tool is installed |
| Codex | `.codex/config.toml` |
| OpenCode | `opencode.json`, or `opencode.jsonc` when that is the one present |
| Kilo Code | `.kilo/kilo.jsonc`, an existing `kilo.json[c]` is reused |
| VS Code | `.vscode/settings.json`, `.vscode/extensions.json`, `.vscode/keybindings.json` |

## More

- [CLI architecture](ARCHITECTURE.md)
- [Framework architecture](../docs/ARCHITECTURE.md)
- [Install guide](../docs/INSTALL.md)
- [Concepts](../docs/CONCEPTS.md)
- [FAQ](../docs/FAQ.md)
- [Contributing](../CONTRIBUTING.md)
