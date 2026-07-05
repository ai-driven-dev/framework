<p align="right">
  <a href="https://github.com/ai-driven-dev/framework/stargazers">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/assets/star-cta-dark.svg" />
      <img src="docs/assets/star-cta-light.svg" alt="Support the community, star us! The button is at the top-right of this page" width="290" />
    </picture>
  </a>
</p>

<div align="center">

<img src="docs/assets/logo.png" alt="AIDD" width="140" />

# AI-Driven Dev Framework

### A French framework for AI-Driven Developers to ship high-quality code.

<p>
  <!--counts:start--><kbd>7 plugins</kbd> · <kbd>40 skills</kbd> · <kbd>2 agents</kbd><!--counts:end--> · <kbd>MIT</kbd>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/ai-driven-dev/framework?include_prereleases&sort=semver)](https://github.com/ai-driven-dev/framework/releases)
[![CI](https://github.com/ai-driven-dev/framework/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ai-driven-dev/framework/actions/workflows/ci.yml)
[![Made in France](https://img.shields.io/badge/made%20in-France-0055A4?labelColor=EF4135)](https://www.ai-driven-dev.fr/)

<p>🗺️ <a href="https://github.com/orgs/ai-driven-dev/projects/8"><b>Live roadmap</b></a></p>

</div>

---

A marketplace of **skills, agents, commands, rules, and recipes** that drive your SDLC — from idea to a tested, shipped PR — the agentic-engineering way.

## ✅ Prerequisites

- **An AI tool we support** — AIDD runs inside your tool:

  | Tool | Status | Formats |
  | --- | --- | --- |
  | **Claude Code** | ✅ Native · recommended | built-in marketplace |
  | **Cursor** | ✅ Supported | marketplace\* · flat |
  | **GitHub Copilot** | ✅ Supported | marketplace\* · flat |
  | **Codex** | ✅ Supported | marketplace\* · flat |
  | **OpenCode** | ✅ Supported | flat |
  | **Gemini · Mistral** | 🚧 In progress | — |

  <sub>\*The marketplace format needs the `aidd` CLI (on the way); the flat archive works today.</sub>

- **[Node](https://nodejs.org)** on your `PATH` — some plugins run small Node hooks automatically ([what they do](docs/ARCHITECTURE.md#bundled-hooks)).

## 📦 Install

### Claude Code

Register the marketplace, then install the plugins (slash commands, not shell):

```text
/plugin marketplace add ai-driven-dev/framework
/plugin install aidd-context@aidd-framework
/plugin install aidd-refine@aidd-framework
/plugin install aidd-dev@aidd-framework
/plugin install aidd-vcs@aidd-framework
/plugin install aidd-pm@aidd-framework
/plugin install aidd-orchestrator@aidd-framework
```

Update anytime: `/plugin marketplace update aidd-framework`.

### Other tools

Each tool ships two archives on every [release](https://github.com/ai-driven-dev/framework/releases/latest): a **flat** one that works today (unzip, no tooling) and a **marketplace** one for when the `aidd` CLI lands.

<details>
<summary><strong>Cursor</strong></summary>

- **Flat** (works today) — download `aidd-framework-cursor-flat-<version>.zip`, unzip into your project root → materializes `.cursor/`.
- **Marketplace** (needs the `aidd` CLI, coming) — `aidd marketplace add aidd-framework ./aidd-framework-cursor-marketplace-<version>`, then install the same plugin names as Claude Code.

</details>

<details>
<summary><strong>GitHub Copilot</strong></summary>

- **Flat** (works today) — download `aidd-framework-copilot-flat-<version>.zip`, unzip into your project root.
- **Marketplace** (needs the `aidd` CLI, coming) — `aidd marketplace add aidd-framework ./aidd-framework-copilot-marketplace-<version>`, then install the plugins.

</details>

<details>
<summary><strong>Codex</strong></summary>

- **Flat** (works today) — download `aidd-framework-codex-flat-<version>.zip`, unzip into your project root.
- **Marketplace** (needs the `aidd` CLI, coming) — `aidd marketplace add aidd-framework ./aidd-framework-codex-marketplace-<version>`, then install the plugins.

</details>

<details>
<summary><strong>OpenCode</strong></summary>

- **Flat** — download `aidd-framework-opencode-flat-<version>.zip`, unzip into your project root → materializes `.opencode/`. (Flat only for now.)

</details>

## 🚀 Quick start

Three ways in — pick one:

| Start with | Command | When |
| --- | --- | --- |
| 🧭 **Guided onboarding** | `/aidd-context:00-onboard` | First time, or unsure what to run — it inspects the project and routes you. |
| 🧠 **Project memory** | `/aidd-context:02-project-memory` | Build the project memory bank by hand. |
| ⚙️ **Feature flow** | `/aidd-dev:00-sdlc` | Ship a feature end to end (plan → implement → review → PR). |

The full loop, and how onboarding sets it up:

```mermaid
flowchart LR
    Onboard(["<b>/aidd-context:00-onboard</b><br/><i>inspect · guide</i>"])

    subgraph setup["① Set up — once"]
      Memory["<b>project memory</b><br/><i>durable project context</i>"]
    end

    subgraph loop["② Per feature — repeat"]
      direction LR
      B["brainstorm"] --> P["plan"] --> I["implement"] --> R["review"] --> C["commit"] --> PR(["✅ PR"])
    end

    Onboard --> Memory --> B

    classDef hub fill:#D97757,stroke:#9c4f37,color:#fff;
    classDef done fill:#2ea043,stroke:#1a7f37,color:#fff;
    class Onboard hub;
    class PR done;
```

## 🧩 Plugins

Seven plugins covering the whole SDLC — **install all of them**; they work together. (`aidd-ui` is 🚧 **alpha**, off the curated path.)

<table>
<tr>
<td width="33%" valign="top">

### 🧭 [aidd-context](plugins/aidd-context/README.md)

`13 skills` · stable

Project init, memory bank, context-artifact generation, diagrams, learning, exploration.

</td>
<td width="33%" valign="top">

### ⚙️ [aidd-dev](plugins/aidd-dev/README.md)

`11 skills` · stable

SDLC loop: plan, implement, assert, audit, review, test, refactor, debug.

</td>
<td width="33%" valign="top">

### 🌿 [aidd-vcs](plugins/aidd-vcs/README.md)

`5 skills` · stable

Repo init, commits, pull / merge requests, release tags, issues.

</td>
</tr>
<tr>
<td width="33%" valign="top">

### 📋 [aidd-pm](plugins/aidd-pm/README.md)

`4 skills` · stable

Ticket info, user stories, PRD, spec drafting.

</td>
<td width="33%" valign="top">

### 🪞 [aidd-refine](plugins/aidd-refine/README.md)

`5 skills` · stable

Brainstorm, challenge, condense, shadow-areas, fact-check.

</td>
<td width="33%" valign="top">

### 🎼 [aidd-orchestrator](plugins/aidd-orchestrator/README.md)

`1 skill` · stable

Async dev: label an issue → get a PR.

</td>
</tr>
<tr>
<td width="33%" valign="top">

### 🎨 [aidd-ui](plugins/aidd-ui/README.md) 🚧

`1 skill` · **alpha**

UI / UX design — smoke-test only, not ready for use.

</td>
</tr>
</table>

Full catalog → [`CATALOG.md`](docs/CATALOG.md).

## 📚 Learn more

| | |
| --- | --- |
| 🍳 **[Recipes](recipes/)** | Task-oriented how-to sheets (e.g. [MCP installations](recipes/mcp-installation.md)). |
| 🏛️ **[Architecture](docs/ARCHITECTURE.md)** | How the framework composes: plugins, skills, hooks, agents. |
| 🧩 **[Create a plugin](docs/CREATE_PLUGIN.md)** | Build and publish your own. |
| 🛒 **[Marketplace](docs/MARKETPLACE.md)** | Install scopes, versioning, LLM tiers. |
| ❓ **[FAQ](docs/FAQ.md)** · **[Troubleshooting](docs/TROUBLESHOOTING.md)** · **[Glossary](docs/GLOSSARY.md)** | Common questions, fixes, and terms. |

## 🔒 Trust and safety

Plugins act with **your permissions**, and some run **Node hooks automatically** at session events ([the list](docs/ARCHITECTURE.md#bundled-hooks)).

Before installing any plugin, skim its `README`, `hooks/`, and `.mcp.json`. Found a vulnerability? Report it privately → [`SECURITY.md`](SECURITY.md).

## 🤝 Community & contributing

Free and open-source (MIT), built by the [AI-Driven Dev](https://www.ai-driven-dev.fr/) community. If it saves you time, [a ⭐](https://github.com/ai-driven-dev/framework/stargazers) helps others find it.

- **Idea or bug?** [Open an issue](https://github.com/ai-driven-dev/framework/issues) or [start a discussion](https://github.com/ai-driven-dev/framework/discussions).
- **Contribute code** → [`CONTRIBUTING.md`](CONTRIBUTING.md).
- **Chat & roadmap** → [Discord](https://discord.gg/EWySJSpjWs) · [train your team](https://www.ai-driven-dev.fr/entreprise).

---

<div align="center">

<img src="https://api.star-history.com/svg?repos=ai-driven-dev/framework&type=Date" alt="Star History Chart" width="500" />

Made with care in France 🇫🇷 · ← [AIDD organisation](https://github.com/ai-driven-dev)

</div>
