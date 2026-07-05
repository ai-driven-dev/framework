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

### A French framework that helps AI-Driven Developers ship high-quality code.

<p>
  <!--counts:start--><kbd>7 plugins</kbd> · <kbd>40 skills</kbd> · <kbd>2 agents</kbd><!--counts:end--> · <kbd>MIT</kbd>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/ai-driven-dev/framework?include_prereleases&sort=semver)](https://github.com/ai-driven-dev/framework/releases)
[![CI](https://github.com/ai-driven-dev/framework/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ai-driven-dev/framework/actions/workflows/ci.yml)
[![Made in France](https://img.shields.io/badge/made%20in-France-0055A4?labelColor=EF4135)](https://www.ai-driven-dev.fr/)

<p>🗺️ <a href="https://github.com/orgs/ai-driven-dev/projects/8"><b>Live roadmap</b></a> - what's shipping Now / Next / Later</p>

</div>

---

## ✨ What is AIDD?

AIDD gives your AI coding assistant ready-made **skills** (step-by-step routines like "plan a feature" or "review this diff"), so it follows a consistent, reviewed process instead of improvising. Use it if you want a repeatable path from an idea to a tested, shipped pull request. See it in [Quick start](#-quick-start) below.

## ✅ Compatibility

Built first for **Claude Code** ✅ (native, recommended). Also supported: **GitHub Copilot** ✅ · **Codex** ✅ · **Cursor** ✅ · **OpenCode** ✅. In progress: **Gemini** 🚧 · **Mistral** 🚧.

## 📦 Installation

**Using Claude Code?** Type these lines directly in your Claude Code session (they're slash commands, not shell commands):

```text
/plugin marketplace add ai-driven-dev/framework
/plugin install aidd-context@aidd-framework
/plugin install aidd-refine@aidd-framework
/plugin install aidd-dev@aidd-framework
/plugin install aidd-vcs@aidd-framework
/plugin install aidd-pm@aidd-framework
/plugin install aidd-orchestrator@aidd-framework
```

That's it - skip to [Quick start](#-quick-start).

### Other tools

Every [release](https://github.com/ai-driven-dev/framework/releases/latest) also attaches an archive per tool, in two formats:

1. **Marketplace** *(recommended when supported)* - register once, then install and update plugins on demand. For Copilot and Codex, grab the `-marketplace-` archive and run `aidd marketplace add`.
2. **Flat** - unzip a `-flat-` archive straight into your project; it drops in `.cursor/`, `.opencode/`, etc. For tools without marketplace support.

Pick your tool for exact steps:

<details>
<summary><strong>GitHub Copilot</strong> - marketplace</summary>

1. Download [`aidd-framework-copilot-marketplace-<version>.zip`](https://github.com/ai-driven-dev/framework/releases/latest) and unzip it.
2. Register the marketplace:
   ```bash
   aidd marketplace add aidd-framework ./aidd-framework-copilot-marketplace-<version>
   ```
3. Install the plugins from the registered `aidd-framework` marketplace (same plugin names as Claude Code).

</details>

<details>
<summary><strong>Codex</strong> - marketplace</summary>

1. Download [`aidd-framework-codex-marketplace-<version>.zip`](https://github.com/ai-driven-dev/framework/releases/latest) and unzip it.
2. Register the marketplace:
   ```bash
   aidd marketplace add aidd-framework ./aidd-framework-codex-marketplace-<version>
   ```
3. Install the plugins from the registered `aidd-framework` marketplace (same plugin names as Claude Code).

</details>

<details>
<summary><strong>Cursor</strong> - flat</summary>

1. Download [`aidd-framework-cursor-flat-<version>.zip`](https://github.com/ai-driven-dev/framework/releases/latest).
2. Unzip it into your project root - it creates `.cursor/`, ready to use.

</details>

<details>
<summary><strong>OpenCode</strong> - flat</summary>

1. Download [`aidd-framework-opencode-flat-<version>.zip`](https://github.com/ai-driven-dev/framework/releases/latest).
2. Unzip it into your project root - it creates `.opencode/`, ready to use.

</details>

## 🚀 Quick start

1. **Onboard first.** One command inspects your project and tells you what to run next:
   ```text
   /aidd-context:00-onboard
   ```
2. **Then run the flow.** A typical feature goes from idea to a tested, shipped PR like this:

```mermaid
flowchart TD
    Idea(["💡 <i>'Add a dark-mode toggle'</i>"])
    Onboard["<b>/aidd-context:00-onboard</b><br/><i>understand the project</i>"]
    Brainstorm["<b>/aidd-refine:01-brainstorm</b><br/><i>clarify the request</i>"]
    Plan["<b>/aidd-dev:01-plan</b><br/><i>draft the technical plan</i>"]
    Implement["<b>/aidd-dev:02-implement</b><br/><i>write the code</i>"]
    Review["<b>/aidd-dev:05-review</b><br/><i>review the diff</i>"]
    Commit["<b>/aidd-vcs:01-commit</b><br/><i>atomic commit</i>"]
    PR(["✅ <b>/aidd-vcs:02-pull-request</b><br/><i>tested · shipped</i>"])

    Idea --> Onboard --> Brainstorm --> Plan --> Implement --> Review --> Commit --> PR

    classDef start fill:#D97757,stroke:#9c4f37,color:#fff;
    classDef done fill:#2ea043,stroke:#1a7f37,color:#fff;
    class Idea start;
    class PR done;
```

> Prefer one command for the whole loop? `/aidd-dev:00-sdlc` runs plan, implement, review, and ship in sequence.

## 🧩 Plugins

Seven plugins cover the whole software lifecycle. Install all of them; they're designed to work together. (`aidd-ui` is 🚧 **alpha, not ready for use** - skip it for now.)

New term? Every word below (skill, plugin, agent...) is defined in one line in the [Glossary](docs/GLOSSARY.md).

<table>
<tr>
<td width="33%" valign="top">

### 🧭 [aidd-context](plugins/aidd-context/README.md)

`13 skills` · stable

Sets up your project, builds its memory, and generates AI config: skills, agents, rules, diagrams.

</td>
<td width="33%" valign="top">

### ⚙️ [aidd-dev](plugins/aidd-dev/README.md)

`11 skills` · stable

The coding loop: plan, implement, assert, audit, review, test, refactor, debug.

</td>
<td width="33%" valign="top">

### 🌿 [aidd-vcs](plugins/aidd-vcs/README.md)

`5 skills` · stable

Commits, pull/merge requests, release tags, issue creation.

</td>
</tr>
<tr>
<td width="33%" valign="top">

### 📋 [aidd-pm](plugins/aidd-pm/README.md)

`4 skills` · stable

Turns a request into ticket info, user stories, a PRD, or a spec.

</td>
<td width="33%" valign="top">

### 🪞 [aidd-refine](plugins/aidd-refine/README.md)

`5 skills` · stable

Sharpens requests and results: brainstorm, challenge, condense, spot blind spots, fact-check.

</td>
<td width="33%" valign="top">

### 🎼 [aidd-orchestrator](plugins/aidd-orchestrator/README.md)

`1 skill` · stable (`async-dev`)

Label an issue, get a PR back; re-label it and get the review applied.

</td>
</tr>
<tr>
<td width="33%" valign="top">

### 🎨 [aidd-ui](plugins/aidd-ui/README.md) 🚧

`1 skill` · **alpha, not ready**

UI and UX: design, review, and improve frontend interfaces. ⚠️ Alpha (`0.1.0-alpha.0`), smoke-test only, do not rely on it yet.

</td>
</tr>
</table>

## 📖 Recipes

Short, task-oriented how-tos. **[Browse all recipes →](recipes/)**

| Recipe | What you'll do |
| --- | --- |
| [MCP installations](recipes/mcp-installation.md) | Choose CLI vs MCP, and wire up the recommended servers (GitHub, Atlassian, Figma, Notion, ...) |

## 🧑‍💻 Community & contributing

Free and open-source (MIT), built by the [AI-Driven Dev](https://www.ai-driven-dev.fr/) community (3 years of R&D, 500+ developers trained). Got an idea or hit a bug? [Open an issue](https://github.com/ai-driven-dev/framework/issues), [start a discussion](https://github.com/ai-driven-dev/framework/discussions), or [join the Discord](https://discord.gg/EWySJSpjWs) (French-speaking). Writing code is reserved for certified Core Team members, see [`GOVERNANCE.md`](./GOVERNANCE.md); everyone else can open issues, discuss, and shape the [roadmap](https://github.com/orgs/ai-driven-dev/projects/8). [Starring the repo](https://github.com/ai-driven-dev/framework/stargazers) helps others find it. [Training your team?](https://www.ai-driven-dev.fr/entreprise)

## 🔒 Trust & safety

Plugins can run commands, edit files, and call external services on your behalf. Before installing any plugin from any marketplace, including this one: read its `README` and `SKILL.md`, inspect its actions, and check what its hooks and MCP servers are allowed to do. Found a vulnerability? Report it privately via [`SECURITY.md`](./SECURITY.md).

## 📚 More documentation

| Doc | What's inside |
| --- | --- |
| [`GLOSSARY.md`](docs/GLOSSARY.md) | Every term used in this framework, defined in one line |
| [`FAQ.md`](docs/FAQ.md) | Common questions, install issues, current limits |
| [`CATALOG.md`](docs/CATALOG.md) | Every skill and action, in one table |
| [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How plugins, skills, and agents fit together; scopes, versioning |
| [`CREATE_PLUGIN.md`](docs/CREATE_PLUGIN.md) | Build your own plugin |
| [`MAINTAINERS.md`](docs/MAINTAINERS.md) | Maintainer and release playbook |

## 📈 Star history

<img src="https://api.star-history.com/svg?repos=ai-driven-dev/framework&type=Date" alt="Star History Chart" width="600" />

---

<div align="center">

Made with care in France 🇫🇷 by the AIDD community

[Back to the AIDD organisation](https://github.com/ai-driven-dev)

</div>
