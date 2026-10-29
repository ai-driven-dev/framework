<div align="center">

<img src="docs/assets/logo.png" alt="AIDD" width="100" />

# AI-Driven Dev Framework

## Enterprise-grade SDLC for high-quality production software development.

Unify **engineering teams** around **standardized workflows** and **shared best practices**, across modern stacks and **legacy systems**, while reducing **technical debt**.

🧱 **IDE agnostic** · 🏗️ **Legacy systems** · 🌱 **Token-optimized** · 🇫🇷 **Made in France**

<p>
  <!--counts:start--><kbd>9 plugins</kbd> · <kbd>51 skills</kbd> · <kbd>2 agents</kbd><!--counts:end-->
</p>

[![Open Source](https://img.shields.io/badge/Open_Source-Yes-yellow?logo=open-source-initiative&logoColor=white)](https://opensource.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/ai-driven-dev/framework?include_prereleases&sort=semver)](https://github.com/ai-driven-dev/framework/releases)
[![CI](https://github.com/ai-driven-dev/framework/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ai-driven-dev/framework/actions/workflows/ci.yml)

<p>
  <a href="docs/INSTALL.md"><b>Install</b></a> ·
  <a href="docs/GUIDES.md"><b>Guides</b></a> ·
  <a href="docs/CATALOG.md"><b>Catalog</b></a> ·
  <a href="docs/FAQ.md"><b>FAQ</b></a> ·
  <a href="CONTRIBUTING.md"><b>Contribute</b></a> ·
  <a href="https://github.com/orgs/ai-driven-dev/projects/8"><b>Roadmap</b></a>
</p>

</div>

---

From a rough idea to a reviewed pull request, inside the AI coding tool you already use.

https://github.com/user-attachments/assets/92474f4c-053a-471d-9c62-16560b7a2a09

<sub>It adapts to you: delegate everything to the AI when you are sure of the task, or stay in the loop and approve the key steps.</sub>

## Works with your tool

<!--tools:start-->

<table>
<thead><tr><th width="800">Tool</th><th width="400" align="center">CLI</th><th width="400" align="center">Plugin marketplace</th><th width="400" align="center">Flat files</th></tr></thead>
<tbody><tr><td><b>Claude Code</b></td><td align="center">✅</td><td align="center">✅</td><td align="center">✅</td></tr>
<tr><td><b>Cursor</b></td><td align="center">✅</td><td align="center">✅</td><td align="center">✅</td></tr>
<tr><td><b>GitHub Copilot</b></td><td align="center">✅</td><td align="center">✅</td><td align="center">✅</td></tr>
<tr><td><b>OpenCode</b></td><td align="center">✅</td><td align="center">—</td><td align="center">✅</td></tr>
<tr><td><b>Kilo Code</b></td><td align="center">✅</td><td align="center">—</td><td align="center">✅</td></tr>
<tr><td><b>Codex</b></td><td align="center">✅</td><td align="center">✅</td><td align="center">✅</td></tr></tbody>
</table>

<!--tools:end-->

<br />

More details: [compatibility](docs/COMPATIBILITY.md).

## Get started

You need [Node](https://nodejs.org) 22.12 or later.

Pick one way.

**Any tool: the CLI.**

```sh
npx @ai-driven-dev/cli@latest setup
```

Bootstraps your project: tool configuration and plugins.

<p align="center">
  <img src="docs/assets/install-demo.svg" alt="Terminal recording: npx @ai-driven-dev/cli setup installs the six recommended plugins into a new project" width="720" />
  <br />
  <sub>Real output, in an empty project, with the flags that skip the questions.</sub>
</p>

**Natively, for tools with a plugin marketplace.**

<details>
<summary>Show the commands (example: Claude Code)</summary>

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

Each tool, updating, removing: [install guide](docs/INSTALL.md).

## Quick start

<table>
<thead><tr><th width="800">Run</th><th width="1200">When</th></tr></thead>
<tbody>
<tr><td><code>/aidd-context:00-onboard</code></td><td>First time, or unsure what to do next. It reads the project and tells you.</td></tr>
<tr><td><code>/aidd-context:02-project-memory</code></td><td>You want the AI to learn your project once, then remember it.</td></tr>
<tr><td><code>/aidd-orchestrator:01-sdlc</code></td><td>You want a feature delivered end to end.</td></tr>
</tbody>
</table>

```mermaid
flowchart TD
  start(["<b>/aidd-context:00-onboard</b><br/>guides you through all of it"])
  subgraph memory["Memory, once per project"]
    projectMemory["<b>/aidd-context:02-project-memory</b><br/>writes the project memory"]
  end
  subgraph frame["Frame"]
    direction LR
    ticket["<b>/aidd-pm:01-ticket-info</b><br/>reads the ticket"] --> brainstorm["<b>/aidd-refine:01-brainstorm</b><br/>clarifies the need"] --> writeContract["<b>/aidd-pm:04-spec</b><br/>writes the contract"]
  end
  subgraph deliver["Deliver"]
    direction LR
    plan["<b>/aidd-dev:01-plan</b><br/>plans"] --> build["<b>/aidd-dev:02-implement</b><br/>builds"] --> assert["<b>/aidd-dev:03-assert</b><br/>validates"]
  end
  subgraph check["Check"]
    direction LR
    review["<b>/aidd-dev:05-review</b><br/>reviews"] --> challenge["<b>/aidd-refine:02-challenge</b><br/>challenges the outcome"] --> pr["<b>/aidd-vcs:02-pull-request</b><br/>opens a draft pull request"]
  end
  start --> memory --> frame --> deliver --> check

  classDef skill fill:#e9ddff,stroke:#8250df,color:#3b1d78
  classDef opt fill:#fff,stroke:#8250df,stroke-dasharray:4 3,color:#3b1d78
  classDef entry fill:#fff,stroke:#8250df,stroke-width:3px,color:#3b1d78
  class projectMemory,writeContract,plan,build,assert,review,challenge,pr skill
  class ticket,brainstorm opt
  class start entry
  style memory fill:none,stroke:#8c959f
  style frame fill:none,stroke:#8c959f
  style deliver fill:none,stroke:#8c959f
  style check fill:none,stroke:#8c959f
```

- Each box is a skill you can run by hand.
- `/aidd-orchestrator:01-sdlc` chains them for you.
- Other goals: [guides by goal](docs/GUIDES.md).

## Plugins

Install the stable ones.

Beta, alpha and preview plugins are off the recommended path.

<!--plugins:start-->

<table>
<tr>
<td width="33%" valign="top">
<a href="plugins/aidd-context/README.md">
<img align="right" alt="stable" src="https://img.shields.io/badge/stable-2da44e?style=flat-square" />
<h3>🧭 aidd-context</h3>
13 skills · 1 hook<br />
Project memory, context generation, learning
</a>
</td>
<td width="33%" valign="top">
<a href="plugins/aidd-dev/README.md">
<img align="right" alt="stable" src="https://img.shields.io/badge/stable-2da44e?style=flat-square" />
<h3>⚙️ aidd-dev</h3>
10 skills · 2 agents<br />
Plan, build, review, test, debug
</a>
</td>
<td width="33%" valign="top">
<a href="plugins/aidd-vcs/README.md">
<img align="right" alt="stable" src="https://img.shields.io/badge/stable-2da44e?style=flat-square" />
<h3>🌿 aidd-vcs</h3>
6 skills<br />
Commits, pull requests, release tags, issues
</a>
</td>
</tr>
<tr>
<td width="33%" valign="top">
<a href="plugins/aidd-pm/README.md">
<img align="right" alt="stable" src="https://img.shields.io/badge/stable-2da44e?style=flat-square" />
<h3>📋 aidd-pm</h3>
10 skills<br />
Briefs, Epics, Stories, specs, Spikes, Defects
</a>
</td>
<td width="33%" valign="top">
<a href="plugins/aidd-refine/README.md">
<img align="right" alt="stable" src="https://img.shields.io/badge/stable-2da44e?style=flat-square" />
<h3>🪞 aidd-refine</h3>
5 skills<br />
Brainstorm, challenge, fact-check
</a>
</td>
<td width="33%" valign="top">
<a href="plugins/aidd-orchestrator/README.md">
<img align="right" alt="stable" src="https://img.shields.io/badge/stable-2da44e?style=flat-square" />
<h3>🎼 aidd-orchestrator</h3>
3 skills<br />
Feature flow, issue-to-PR automation, backlog
</a>
</td>
</tr>
<tr>
<td width="33%" valign="top">
<a href="plugins/aidd-ui/README.md">
<img align="right" alt="alpha" src="https://img.shields.io/badge/alpha-cf222e?style=flat-square" />
<h3>🎨 aidd-ui</h3>
1 skill<br />
UI and UX design, smoke test only
</a>
</td>
<td width="33%" valign="top">
<a href="plugins/aidd-telemetry/README.md">
<img align="right" alt="beta" src="https://img.shields.io/badge/beta-bf8700?style=flat-square" />
<h3>📈 aidd-telemetry</h3>
2 skills · 2 hooks<br />
Token usage per task, opt-in
</a>
</td>
<td width="33%" valign="top">
<a href="plugins/aidd-qa/README.md">
<img align="right" alt="preview" src="https://img.shields.io/badge/preview-0969da?style=flat-square" />
<h3>🎬 aidd-qa</h3>
1 skill<br />
Acceptance QA with video evidence
</a>
</td>
</tr>
</table>

<!--plugins:end-->

## Documentation

<table>
<thead><tr><th width="300">For</th><th width="500">Document</th><th width="1200">Read it to</th></tr></thead>
<tbody>
<tr><td rowspan="8"><b>Use it</b></td><td><a href="docs/INSTALL.md">Install</a></td><td>Install, update or remove it</td></tr>
<tr><td><a href="docs/GUIDES.md">Guides</a></td><td>Find the skills for your goal: fix a bug, build a feature</td></tr>
<tr><td><a href="docs/CONCEPTS.md">Concepts</a></td><td>Learn the terms and how project memory works</td></tr>
<tr><td><a href="docs/CATALOG.md">Catalog</a></td><td>See every skill and what it does</td></tr>
<tr><td><a href="docs/COMPATIBILITY.md">Compatibility</a></td><td>See what each tool receives</td></tr>
<tr><td><a href="cli/README.md">CLI</a></td><td>Look up a command</td></tr>
<tr><td><a href="docs/FAQ.md">FAQ</a></td><td>Check cost, security and measurement</td></tr>
<tr><td><a href="CHANGELOG.md">Changelog</a></td><td>See what changed</td></tr>
<tr><td rowspan="2"><b>Contribute</b></td><td><a href="CONTRIBUTING.md">Contributing</a></td><td>Follow the contribution flow</td></tr>
<tr><td><a href="docs/ARCHITECTURE.md">Architecture</a></td><td>Know where a capability belongs</td></tr>
<tr><td rowspan="3"><b>Maintain</b></td><td><a href="docs/MAINTAINERS.md">Maintainers</a></td><td>Run releases, add a plugin</td></tr>
<tr><td><a href="GOVERNANCE.md">Governance</a></td><td>See who decides, and how the roadmap is set</td></tr>
<tr><td><a href="RELEASE.md">Releases</a></td><td>Follow the release cycle</td></tr>
<tr><td rowspan="2"><b>Get help</b></td><td><a href=".github/SUPPORT.md">Support</a></td><td>Ask a question or report a bug</td></tr>
<tr><td><a href="SECURITY.md">Security</a></td><td>Report a vulnerability privately</td></tr>
</tbody>
</table>

## Community

> [!TIP]
> **Found it useful? [⭐ Star the repository](https://github.com/ai-driven-dev/framework/stargazers).**
> It helps other developers find it.

Built by the [AI-Driven Dev](https://www.ai-driven-dev.fr/) community.

- Based on the [AI-Driven Development Manifesto](https://www.ai-driven-development.org/)
- 3 years of R&D
- 500+ developers trained
- Production software shipped with 100% AI-generated code
- Free and open source (MIT)

[Discord 🇫🇷](https://discord.gg/EWySJSpjWs) · [Discussions](https://github.com/ai-driven-dev/framework/discussions) · [Issues](https://github.com/ai-driven-dev/framework/issues) · [Team training](https://www.ai-driven-dev.fr/entreprise) · [How the roadmap is set](GOVERNANCE.md#influence-the-roadmap)

[![Contributors](https://contrib.rocks/image?repo=ai-driven-dev/framework)](https://github.com/ai-driven-dev/framework/graphs/contributors)

---

<div align="center">

<a href="https://github.com/ai-driven-dev/framework/stargazers"><img src="https://raw.githubusercontent.com/ai-driven-dev/framework/star-history/star-history.svg" alt="Star History Chart" width="500" /></a>

Made with care in France 🇫🇷

</div>
