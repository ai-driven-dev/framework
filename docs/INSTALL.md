# Install

## Requirements

- [Node](https://nodejs.org) 22.12 or later (`node --version`).
- A [supported AI coding tool](COMPATIBILITY.md).

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
npx @ai-driven-dev/cli@latest setup --ai claude --plugins recommended --yes
```

### Check

```sh
npx @ai-driven-dev/cli@latest doctor
```

It lists what is installed and what needs fixing.

> Every command: [CLI reference](../cli/README.md).

## Marketplace

<details>
<summary><b>Claude Code</b></summary>

<br />

In a session, run:

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
<summary><b>GitHub Copilot</b></summary>

<br />

1. Download `aidd-framework-copilot-marketplace-<version>.zip` from the [latest release](https://github.com/ai-driven-dev/framework/releases/latest).
2. Unzip it, and keep the folder where it is.
3. Run, once per plugin:

```sh
copilot plugin marketplace add ./aidd-framework-copilot-marketplace-<version>
copilot plugin install aidd-context@aidd-framework
```

</details>

<details>
<summary><b>Codex</b></summary>

<br />

1. Download `aidd-framework-codex-marketplace-<version>.zip` from the [latest release](https://github.com/ai-driven-dev/framework/releases/latest).
2. Unzip it.
3. Run, once per plugin:

```sh
codex plugin marketplace add ./aidd-framework-codex-marketplace-<version>
codex plugin add aidd-context@aidd-framework
```

</details>

<details>
<summary><b>Cursor</b></summary>

<br />

1. Download `aidd-framework-cursor-marketplace-<version>.zip` from the [latest release](https://github.com/ai-driven-dev/framework/releases/latest).
2. Unzip it.
3. Copy the plugins:

```sh
cp -r aidd-framework-cursor-marketplace-<version>/plugins/aidd-* ~/.cursor/plugins/local/
```

4. In Cursor, run **Developer: Reload Window**.

</details>

## Flat files

Generate the files with the CLI:

```sh
git clone https://github.com/ai-driven-dev/framework.git
npx @ai-driven-dev/cli@latest translate ./framework --to <tool> --as flat --out .
```

Replace `<tool>` with your [target tool](../cli/README.md#translate).

<details>
<summary>Without Node</summary>

Download `aidd-framework-<tool>-flat-<version>.zip` from the [latest release](https://github.com/ai-driven-dev/framework/releases/latest). Extract it, then copy the extracted folder's contents, including hidden files, into your project. Merge existing configuration files.

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

Keep files shared with another tool.

## Problems

See [Support](../.github/SUPPORT.md).
