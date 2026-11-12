# Install

## Requirements

- [Node](https://nodejs.org) 22.12 or later (`node --version`).
- An AI coding tool: Claude Code, Cursor, GitHub Copilot, Codex, OpenCode, Kilo Code, Kiro (IDE, CLI V3) or Antigravity CLI.

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

*On Kiro, read the Kiro notes under [Flat files](#flat-files) before the first session: they apply to this method too.*

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

*OpenCode, Kilo Code and Kiro have no marketplace: use flat files. Antigravity CLI also uses flat files.*

## Flat files

Generate the files with the CLI:

```sh
git clone https://github.com/ai-driven-dev/framework.git
npx @ai-driven-dev/cli@latest translate ./framework --to <tool> --as flat --out .
```

Replace `<tool>` with your tool: `claude`, `cursor`, `copilot`, `codex`, `opencode`, `kilo`, `kiro` or `antigravity`.

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

<details>
<summary><b>Kiro</b></summary>

<br />

- For every project at once, put the files in your home directory instead: copy the release archive there (`cp -R aidd-framework-kiro-flat-<version>/. ~`), or run `translate` with `--out ~` from a clone kept outside your home directory. The CLI refuses an output directory that contains its source.
- Keep the project memory in `AGENTS.md` at the project root. For a home-directory install, a global `AGENTS.md` goes in `~/.kiro/steering/`.
- Run the CLI on its V3 engine (`kiro-cli --v3`, or `kiro-cli settings chat.agentEngine v3`): the 2.x engine ignores `.kiro/hooks/`, so the memory refresh does not run.
- Only a plugin's session start hooks are carried over, the memory refresh among them: Kiro names its tools differently, so a hook on a tool call is left out.
- Trust the workspace when Kiro asks: an untrusted one loads no workspace skills or agents and runs no hook. A trust granted after the window opened counts from the next window, so reopen it before expecting the memory refresh.
- Kiro Crew is not covered: it reads skills and hooks from its own `~/.kiro/crew/` paths.

</details>

## Update

| Installed with | Run |
| --- | --- |
| CLI | `npx @ai-driven-dev/cli@latest plugin update` |
| CLI, every project | `npx @ai-driven-dev/cli@latest sync --global` |
| Claude Code marketplace | `claude plugin update <plugin>@aidd-framework` |
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
