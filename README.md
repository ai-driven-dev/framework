<div align="center">

<img src="docs/assets/logo.png" alt="AIDD" width="100" />

# AI-Driven Dev Framework

## Enterprise-grade SDLC for high-quality software development.

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

You need [Node](https://nodejs.org) 22.12 or later. Pick one way.

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
<thead><tr><th>Run</th><th>When</th></tr></thead>
<tbody>
<tr><td><code>/aidd-context:00-onboard</code></td><td>First time, or unsure what to do next. It reads the project and tells you.</td></tr>
<tr><td><code>/aidd-context:02-project-memory</code></td><td>You want the AI to learn your project once, then remember it.</td></tr>
<tr><td><code>/aidd-orchestrator:01-sdlc</code></td><td>You want a feature delivered end to end.</td></tr>
</tbody>
</table>

Onboarding and project memory happen once. Then `/aidd-orchestrator:01-sdlc` runs every feature along the same chain.

<!--sdlc:start-->

<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/assets/diagrams/sdlc-dark.svg"><img src="docs/assets/diagrams/sdlc-light.svg" alt="Frame: request, ticket-info, brainstorm, spec. Deliver: plan, implement, assert, commit. Check: review, challenge, pull-request. assert repeats until checks pass, and Check findings go back to Deliver." width="640"></picture></p>

<!--sdlc:end-->

Fixing a bug, changing one thing, investigating? See the [guides by goal](docs/GUIDES.md).

## Plugins

Install the six stable ones. The other three are off the recommended path.

<!--plugins:start-->

<p align="center">
<a href="plugins/aidd-context/README.md"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/assets/plugins/aidd-context-dark.svg"><img src="docs/assets/plugins/aidd-context-light.svg" alt="aidd-context, stable, 13 skills: Project memory, context generation, learning" width="292"></picture></a>
<a href="plugins/aidd-dev/README.md"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/assets/plugins/aidd-dev-dark.svg"><img src="docs/assets/plugins/aidd-dev-light.svg" alt="aidd-dev, stable, 10 skills: Plan, build, review, test, debug" width="292"></picture></a>
<a href="plugins/aidd-vcs/README.md"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/assets/plugins/aidd-vcs-dark.svg"><img src="docs/assets/plugins/aidd-vcs-light.svg" alt="aidd-vcs, stable, 6 skills: Commits, pull requests, release tags, issues" width="292"></picture></a>
<a href="plugins/aidd-pm/README.md"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/assets/plugins/aidd-pm-dark.svg"><img src="docs/assets/plugins/aidd-pm-light.svg" alt="aidd-pm, stable, 10 skills: Briefs, Epics, Stories, specs, Spikes, Defects" width="292"></picture></a>
<a href="plugins/aidd-refine/README.md"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/assets/plugins/aidd-refine-dark.svg"><img src="docs/assets/plugins/aidd-refine-light.svg" alt="aidd-refine, stable, 5 skills: Brainstorm, challenge, fact-check" width="292"></picture></a>
<a href="plugins/aidd-orchestrator/README.md"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/assets/plugins/aidd-orchestrator-dark.svg"><img src="docs/assets/plugins/aidd-orchestrator-light.svg" alt="aidd-orchestrator, stable, 3 skills: Feature flow, issue-to-PR automation, backlog" width="292"></picture></a>
<a href="plugins/aidd-ui/README.md"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/assets/plugins/aidd-ui-dark.svg"><img src="docs/assets/plugins/aidd-ui-light.svg" alt="aidd-ui, alpha, 1 skill: UI and UX design, smoke test only" width="292"></picture></a>
<a href="plugins/aidd-telemetry/README.md"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/assets/plugins/aidd-telemetry-dark.svg"><img src="docs/assets/plugins/aidd-telemetry-light.svg" alt="aidd-telemetry, beta, 2 skills: Token usage per task, opt-in" width="292"></picture></a>
<a href="plugins/aidd-qa/README.md"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/assets/plugins/aidd-qa-dark.svg"><img src="docs/assets/plugins/aidd-qa-light.svg" alt="aidd-qa, new, 1 skill: Acceptance QA with video evidence" width="292"></picture></a>
</p>

<!--plugins:end-->

## Documentation

<table>
<thead><tr><th>For</th><th>Document</th><th>Read it to</th></tr></thead>
<tbody>
<tr><td rowspan="8"><b>Use it</b></td><td><a href="docs/INSTALL.md">Install</a></td><td>Install, update or remove it</td></tr>
<tr><td><a href="docs/GUIDES.md">Guides</a></td><td>Find the skills for your goal: fix a bug, build a feature</td></tr>
<tr><td><a href="docs/CONCEPTS.md">Concepts</a></td><td>Learn the terms and how project memory works</td></tr>
<tr><td><a href="docs/CATALOG.md">Catalog</a></td><td>See every skill and what it does</td></tr>
<tr><td><a href="docs/COMPATIBILITY.md">Compatibility</a></td><td>See what each tool receives</td></tr>
<tr><td><a href="cli/README.md">CLI</a></td><td>Look up a command</td></tr>
<tr><td><a href="docs/FAQ.md">FAQ</a></td><td>Check cost, security and limits</td></tr>
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

## Security and privacy

- **Permissions.** A plugin can run scripts. Read it before you install it: [what runs, and when](docs/ARCHITECTURE.md#-bundled-hooks).
- **Telemetry.** Off by default. It only runs if you opt in: [how it works](docs/FAQ.md#measurement).
- **Vulnerabilities.** Report them privately: [`SECURITY.md`](SECURITY.md).

## Community

Built by the [AI-Driven Dev](https://www.ai-driven-dev.fr/) community: 3 years of R&D, 500+ developers trained, production software shipped with 100% AI-generated code. Free and open source (MIT); a [⭐](https://github.com/ai-driven-dev/framework/stargazers) helps others find it.

[Discord 🇫🇷](https://discord.gg/EWySJSpjWs) · [Discussions](https://github.com/ai-driven-dev/framework/discussions) · [Issues](https://github.com/ai-driven-dev/framework/issues) · [Team training](https://www.ai-driven-dev.fr/entreprise) · [How the roadmap is set](GOVERNANCE.md#how-to-influence-the-roadmap)

[![Contributors](https://contrib.rocks/image?repo=ai-driven-dev/framework)](https://github.com/ai-driven-dev/framework/graphs/contributors)

---

<div align="center">

<a href="https://github.com/ai-driven-dev/framework/stargazers"><img src="https://raw.githubusercontent.com/ai-driven-dev/framework/star-history/star-history.svg" alt="Star History Chart" width="500" /></a>

Made with care in France 🇫🇷 · ← [AIDD organisation](https://github.com/ai-driven-dev)

</div>
