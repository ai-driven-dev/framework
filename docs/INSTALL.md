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

*OpenCode, Kilo Code and Antigravity CLI use flat files.*

## Flat files

Generate the files with the CLI:

```sh
git clone https://github.com/ai-driven-dev/framework.git
npx @ai-driven-dev/cli@latest translate ./framework --to cursor --as flat --out .
```

Replace `cursor` with your tool: `claude`, `cursor`, `copilot`, `codex`, `opencode`, `kilo` or `antigravity`.

For an Antigravity archive, follow the [Antigravity steps](#antigravity-cli) to preserve existing hooks.

<details>
<summary>Without Node</summary>

Download `aidd-framework-<tool>-flat-<version>.zip` from the [latest release](https://github.com/ai-driven-dev/framework/releases/latest). In your project root, run:

```sh
unzip aidd-framework-<tool>-flat-<version>.zip
cp -R aidd-framework-<tool>-flat-<version>/. .
```

</details>

### Antigravity CLI

1. Extract `antigravity-flat` into an empty directory. Find `.agents/` inside the extracted archive's enclosing folder.
2. Copy its skills, agents and hook scripts into the matching `.agents/` paths in your project. Resolve any existing-file conflicts before replacing files.
3. If your project has no `.agents/hooks.json`, copy the archive's file. Otherwise merge its named top-level entries into the existing JSON, preserving user entries. Resolve any same-name conflict explicitly; extraction does not merge JSON files.
4. Start `agy` in the project.

Codex flat also uses `.agents/skills/`. Removing either tool can delete skills the other still uses.

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
