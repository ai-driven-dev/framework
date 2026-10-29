# Install

## Requirements

- [Node](https://nodejs.org) 22.12 or later. Check with `node --version`.
- An AI coding tool: Claude Code, Cursor, GitHub Copilot, Codex, OpenCode or Kilo Code.

## Pick a method

| Method | Pick it when |
| --- | --- |
| [CLI](#cli) | You want one command that does everything. It works with every tool. |
| [Marketplace](#marketplace) | You want your tool's plugin manager to install and update the plugins. |
| [Flat files](#flat-files) | You want plain files in your project, to commit them or because your tool has no plugin manager. |

## CLI

### Install

```sh
npx @ai-driven-dev/cli@latest setup
```

It asks for your tool and your plugins, then installs them in your project.

*Example for Claude Code, without the questions:*

```sh
npx @ai-driven-dev/cli@latest setup --ai claude --plugins recommended --yes
```

### Check

```sh
npx @ai-driven-dev/cli@latest doctor
```

It lists what is installed and what needs fixing.

Every command: [CLI reference](../cli/README.md).

## Marketplace

<details>
<summary>Claude Code</summary>

In a session:

```text
/plugin marketplace add ai-driven-dev/framework
/plugin install aidd-context@aidd-framework
/plugin install aidd-refine@aidd-framework
/plugin install aidd-dev@aidd-framework
/plugin install aidd-vcs@aidd-framework
/plugin install aidd-pm@aidd-framework
/plugin install aidd-orchestrator@aidd-framework
```

</details>

<details>
<summary>GitHub Copilot</summary>

Download `aidd-framework-copilot-marketplace-<version>.zip` from the [latest release](https://github.com/ai-driven-dev/framework/releases/latest) and unzip it. Then:

```sh
copilot plugin marketplace add ./aidd-framework-copilot-marketplace-<version>
copilot plugin install aidd-context@aidd-framework
```

Run the second line for each plugin. Keep the unzipped folder where it is.

</details>

<details>
<summary>Codex</summary>

Download `aidd-framework-codex-marketplace-<version>.zip` from the [latest release](https://github.com/ai-driven-dev/framework/releases/latest) and unzip it. Then:

```sh
codex plugin marketplace add ./aidd-framework-codex-marketplace-<version>
codex plugin add aidd-context@aidd-framework
```

Run the second line for each plugin.

</details>

<details>
<summary>Cursor</summary>

Download `aidd-framework-cursor-marketplace-<version>.zip` from the [latest release](https://github.com/ai-driven-dev/framework/releases/latest) and unzip it. Then:

```sh
cp -r aidd-framework-cursor-marketplace-<version>/plugins/aidd-* ~/.cursor/plugins/local/
```

Run **Developer: Reload Window** in Cursor.

</details>

*OpenCode and Kilo Code have no marketplace: use flat files.*

## Flat files

Generate the files with the CLI:

```sh
git clone https://github.com/ai-driven-dev/framework.git
npx @ai-driven-dev/cli@latest translate ./framework --to cursor --as flat --out .
```

Replace `cursor` with your tool: `claude`, `cursor`, `copilot`, `codex`, `opencode` or `kilo`.

<details>
<summary>Without Node</summary>

Download `aidd-framework-<tool>-flat-<version>.zip` from the [latest release](https://github.com/ai-driven-dev/framework/releases/latest). In your project root, run:

```sh
unzip aidd-framework-<tool>-flat-<version>.zip
cp -R aidd-framework-<tool>-flat-<version>/. .
```

</details>

## Update

| Installed with | Run |
| --- | --- |
| CLI | `npx @ai-driven-dev/cli@latest plugin update` |
| Claude Code marketplace | `claude plugin update <plugin>@aidd-framework` |
| Flat files | The same `translate` command, with `--force` |

For another tool's marketplace, use that tool's plugin manager.

## Remove

| Installed with | Run |
| --- | --- |
| CLI, one plugin | `npx @ai-driven-dev/cli@latest plugin remove <plugin>` |
| CLI, everything | `npx @ai-driven-dev/cli@latest clean` previews. Add `--force` to delete |
| Claude Code marketplace | `claude plugin uninstall <plugin>` |
| Flat files | Delete the files you copied |

## Problems

See [Support](../.github/SUPPORT.md).
