# Install

## Requirements

- [Node](https://nodejs.org) 22.12 or later (`node --version`).
- An AI coding tool: Claude Code, Cursor, GitHub Copilot, Codex, OpenCode, Kilo Code or Antigravity CLI.

## Pick a method

| Method | Pick it when |
| --- | --- |
| [CLI](#cli) | You want one command that does everything. It works with every tool. |
| [Marketplace](#marketplace) | You want your tool's plugin manager to install and update the plugins. |
| [Flat files](#flat-files) | You want plain files in your project, to commit them or because your tool has no plugin manager. |

Not every tool supports every method: see the [compatibility table](COMPATIBILITY.md).

## CLI

### Install

```sh
npx @ai-driven-dev/cli@latest setup
```

It asks for your tool and your plugins, then installs them in your project.

*Example for Claude Code, without the questions:*

```sh
npx @ai-driven-dev/cli@latest setup --ide claude --plugins recommended --yes
```

### For every project

```sh
npx @ai-driven-dev/cli@latest setup --global --ide claude,codex,opencode --plugins all --yes
```

It installs the plugins once for the whole machine and writes nothing in your project. It takes any of `claude`, `codex`, `copilot`, `cursor`, `kilo` and `opencode`: [what each one gets](../cli/README.md#scope).

### Check

```sh
npx @ai-driven-dev/cli@latest doctor
```

It lists what is installed and what needs fixing.

> Every command: [CLI reference](../cli/README.md).

## Marketplace

Use the [AIDD distribution repository](https://github.com/ai-driven-dev/marketplaces) with the ref for your tool. The tool branch follows releases. To stay on one release, use `<tool>-v<version>` as the ref where documented below. The [release ZIPs](https://github.com/ai-driven-dev/framework/releases) remain available for local installs.

<details>
<summary><b>Claude Code</b></summary>

<br />

In a session, run:

```text
/plugin marketplace add https://github.com/ai-driven-dev/marketplaces.git#claude
/plugin install aidd-context@aidd-marketplace
/plugin install aidd-refine@aidd-marketplace
/plugin install aidd-dev@aidd-marketplace
/plugin install aidd-vcs@aidd-marketplace
/plugin install aidd-pm@aidd-marketplace
/plugin install aidd-orchestrator@aidd-marketplace
```

For a pinned install, replace `claude` with `claude-v<version>`.

If you already use `ai-driven-dev/framework`, that catalog receives the first two releases of the transition and then serves the second release indefinitely. Before switching, use `claude plugin list --json` to record plugin names and scopes. In your user, project, and project-local settings, check for old IDs in `enabledPlugins` and `pluginConfigs` and for an old marketplace declaration in `extraKnownMarketplaces`.

1. Add the new catalog and install each plugin using `claude plugin install <plugin>@aidd-marketplace --scope <scope>` for each scope where it was installed.
2. Restore enablement and settings under the new plugin IDs. Re-enter secrets in Claude Code. Update any project or user settings that declare the old marketplace. Avoid enabling both copies of a plugin during normal use.
3. Verify the new plugins and their settings, then remove the old catalog with `claude plugin marketplace remove aidd-framework`. Removal uninstalls plugins tied to the old catalog and can delete their saved settings and data. [Claude Code marketplace management](https://code.claude.com/docs/en/plugins/host-marketplace) · [Settings scopes](https://code.claude.com/docs/en/settings)

For a local install, extract `aidd-framework-claude-marketplace-<version>.zip` and add the extracted directory. Its plugin IDs use `@aidd-framework`.

</details>

<details>
<summary><b>GitHub Copilot</b></summary>

<br />

With GitHub Copilot CLI:

```sh
copilot plugin marketplace add https://github.com/ai-driven-dev/marketplaces.git#copilot
copilot plugin install aidd-context@aidd-framework
```

To pin a version, use `#copilot-v<version>`. For a local catalog, extract `aidd-framework-copilot-marketplace-<version>.zip` and pass its directory to `copilot plugin marketplace add`.

</details>

<details>
<summary><b>Codex</b></summary>

<br />

With Codex CLI:

```sh
codex plugin marketplace add https://github.com/ai-driven-dev/marketplaces.git --ref codex
codex plugin add aidd-context@aidd-framework
```

To pin a version, use `--ref codex-v<version>`. For a local catalog, extract `aidd-framework-codex-marketplace-<version>.zip` and pass its directory to `codex plugin marketplace add`.

</details>

<details>
<summary><b>Cursor</b></summary>

<br />

Cursor Teams and Enterprise offer Git-backed team marketplaces. The AIDD catalog is on the distribution repository’s default branch, `cursor`. The hosted installation in the team client still needs verification. [Cursor team marketplaces](https://cursor.com/docs/plugins)

```sh
cursor-agent plugin marketplace add https://github.com/ai-driven-dev/marketplaces.git --git-ref cursor
```

For a local installation where local plugins are enabled:

1. Download `aidd-framework-cursor-marketplace-<version>.zip` from the [latest release](https://github.com/ai-driven-dev/framework/releases/latest).
2. Unzip it.
3. Copy the plugins:

```sh
cp -r aidd-framework-cursor-marketplace-<version>/plugins/aidd-* ~/.cursor/plugins/local/
```

4. In Cursor, run **Developer: Reload Window**.

</details>

For OpenCode, Kilo Code, and Antigravity CLI, AIDD distributes flat files. See [Compatibility](COMPATIBILITY.md#hosted-marketplaces) for each tool’s distribution options.

## Flat files

Generate the files with the CLI:

```sh
git clone https://github.com/ai-driven-dev/framework.git
npx @ai-driven-dev/cli@latest translate ./framework --to <tool> --as flat --out .
```

Replace `<tool>` with your tool: `claude`, `cursor`, `copilot`, `codex`, `opencode`, `kilo` or `antigravity`.

<details>
<summary>Without Node</summary>

Download `aidd-framework-<tool>-flat-<version>.zip` from the [latest release](https://github.com/ai-driven-dev/framework/releases/latest). In your project root, run:

```sh
unzip aidd-framework-<tool>-flat-<version>.zip
```

If a configuration file already exists, merge its contents into the extracted copy. Then copy the files, including hidden files:

```sh
cp -R aidd-framework-<tool>-flat-<version>/. .
```

</details>

## Update

| Installed with | Run |
| --- | --- |
| CLI | `npx @ai-driven-dev/cli@latest plugin update` |
| CLI, every project | `npx @ai-driven-dev/cli@latest sync --global` |
| Claude Code marketplace | `claude plugin marketplace update aidd-marketplace`, then `claude plugin update <plugin>@aidd-marketplace` |
| Flat files | The same `translate` command, with `--force` |

For another tool's marketplace, use that tool's plugin manager.

## Remove

| Installed with | Run |
| --- | --- |
| CLI, one plugin | `npx @ai-driven-dev/cli@latest plugin remove <plugin>` |
| CLI, everything | `npx @ai-driven-dev/cli@latest clean` previews. Add `--force` to delete |
| CLI, every project | `npx @ai-driven-dev/cli@latest clean --global --force` |
| Claude Code marketplace | `claude plugin uninstall <plugin>` |
| Flat files | Delete the files you copied |

Codex and Antigravity share `.agents/skills/`. When removing either tool, keep skills still used by the other.

## Problems

See [Support](../.github/SUPPORT.md).
