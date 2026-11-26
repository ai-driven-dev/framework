# Install

## Requirements

- [Node](https://nodejs.org) 22.12 or later (`node --version`) for the AIDD CLI and JavaScript hooks.
- An AI coding tool: Claude Code, Cursor, GitHub Copilot, Codex, OpenCode, Kilo Code, Antigravity CLI, Kiro or Kimi Code CLI.

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

It installs the plugins once for the whole machine and writes nothing in your project. It takes any of `claude`, `codex`, `copilot`, `cursor`, `kilo`, `kimi` and `opencode`: [what each one gets](../cli/README.md#scope).

### Check

```sh
npx @ai-driven-dev/cli@latest doctor
```

It lists what is installed and what needs fixing.

> Every command: [CLI reference](../cli/README.md).

## Marketplace

Choose your tool. [Claude Code](#claude-code) · [GitHub Copilot](#github-copilot) · [Codex](#codex) · [Cursor](#cursor) · [Antigravity CLI](#antigravity-cli)

The commands below follow the latest version available for each tool in the [AIDD distribution repository](https://github.com/ai-driven-dev/marketplaces). Each tool also has [release ZIPs](https://github.com/ai-driven-dev/framework/releases).

Claude Code uses AIDD’s recommended Anthropic models and effort for the orchestration agents. The Codex flat distribution uses OpenAI. Copilot and Cursor agents inherit the session’s model and effort. [Choose an AIDD model profile or restore inheritance](SUBAGENTS.md#change-the-recommended-models).

### Claude Code

Install the first plugin from your terminal:

```sh
claude plugin install aidd-context --marketplace 'https://github.com/ai-driven-dev/marketplaces.git#claude'
```

Open Claude Code in your project and run `/aidd-context:00-onboard`. The first command also registers the AIDD catalog. Add the other recommended plugins as needed:

```text
/plugin install aidd-refine@aidd-marketplace
/plugin install aidd-dev@aidd-marketplace
/plugin install aidd-vcs@aidd-marketplace
/plugin install aidd-pm@aidd-marketplace
/plugin install aidd-orchestrator@aidd-marketplace
```

For a pinned install, replace `claude` with `claude-v<version>`.

<details>
<summary>Migrate an existing Claude Code installation</summary>

If you already use `ai-driven-dev/framework`, that catalog follows the first two releases successfully published to the new Claude Code branch during the transition, then serves the second of those releases indefinitely. Replays of older releases cannot roll back the catalog. Before switching, use `claude plugin list --json` to record plugin names and scopes. In your user, project, and project-local settings, check for old IDs in `enabledPlugins` and `pluginConfigs` and for an old marketplace declaration in `extraKnownMarketplaces`.

1. Add the new catalog and install each plugin using `claude plugin install <plugin>@aidd-marketplace --scope <scope>` for each scope where it was installed.
2. Restore enablement and settings under the new plugin IDs. Re-enter secrets in Claude Code. Update any project or user settings that declare the old marketplace. Avoid enabling both copies of a plugin during normal use.
3. Verify the new plugins and their settings, then remove the old catalog with `claude plugin marketplace remove aidd-framework`. Removal uninstalls plugins tied to the old catalog and can delete their saved settings and data. [Claude Code marketplace management](https://code.claude.com/docs/en/plugins/host-marketplace) · [Settings scopes](https://code.claude.com/docs/en/settings)

</details>

For a local install, extract `aidd-framework-claude-marketplace-<version>.zip` and add the extracted directory. Its plugin IDs use `@aidd-framework`.

### GitHub Copilot

With GitHub Copilot CLI:

```sh
copilot plugin marketplace add https://github.com/ai-driven-dev/marketplaces.git#copilot
copilot plugin install aidd-context@aidd-framework
```

To pin a version, use `#copilot-v<version>`. For a local catalog, extract `aidd-framework-copilot-marketplace-<version>.zip` and pass its directory to `copilot plugin marketplace add`.

### Codex

**For AIDD subagents**, use the [Codex flat-file ZIP](#flat-files) for the current project, or install for all your projects with the CLI:

```sh
npx @ai-driven-dev/cli@latest setup --global --ide codex --plugins recommended --provider openai --agents-only --yes
```

Codex loads subagents from its user or project agent directory. Installing from the catalog alone leaves the included agent TOMLs inactive.

**For native plugins** (skills, hooks, and MCP), use the Codex CLI:

```sh
codex plugin marketplace add https://github.com/ai-driven-dev/marketplaces.git --ref codex
codex plugin add aidd-context@aidd-framework
```

To pin a version, use `--ref codex-v<version>`. For a local catalog, extract `aidd-framework-codex-marketplace-<version>.zip` and pass its directory to `codex plugin marketplace add`.

### Cursor

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

### Antigravity CLI

1. Download `aidd-framework-antigravity-marketplace-<version>.zip` from the [latest release](https://github.com/ai-driven-dev/framework/releases/latest). Antigravity registers no marketplace: copy its plugin directories.
2. Unzip it.
3. From your project's root, copy the plugins:

```sh
mkdir -p .agents/plugins
cp -r aidd-framework-antigravity-marketplace-<version>/plugins/aidd-* .agents/plugins/
```

### Kimi Code CLI

1. Download `aidd-framework-kimi-marketplace-<version>.zip` from the [latest release](https://github.com/ai-driven-dev/framework/releases/latest). It holds plugin directories, not a catalog.
2. Unzip it. The plugins are the `plugins/aidd-*` directories.
3. Installing them by hand in Kimi's web UI is unverified. `aidd setup --global --ide kimi` installs the plugins through the server Kimi starts.

OpenCode and Kilo Code have no marketplace: use flat files. Kiro also uses flat files. The Antigravity CLI installs each plugin as a directory under `.agents/plugins/`.

## Flat files

Generate the files with the CLI:

```sh
git clone https://github.com/ai-driven-dev/framework.git
npx @ai-driven-dev/cli@latest translate ./framework --to <tool> --as flat --out .
```

Replace `<tool>` with your tool: `claude`, `cursor`, `copilot`, `codex`, `opencode`, `kilo`, `antigravity`, `kiro` or `kimi`.

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

Codex, Antigravity (flat files) and Kimi share `.agents/skills/`. When removing any of them, keep skills still used by another.

## Problems

See [Support](../.github/SUPPORT.md).
