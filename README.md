<div align="center">

<img src="docs/assets/logo.png" alt="AIDD" width="140" />

# AI-Driven Dev Framework

### A community-maintained marketplace of skills, agents, and rules for Claude Code.

<p>
  <kbd>6 plugins</kbd> · <kbd>31 skills</kbd> · <kbd>3 agents</kbd> · <kbd>MIT</kbd>
</p>

<p>
  <a href="#quick-start"><strong>Quick start →</strong></a> ·
  <a href="#plugins"><strong>Browse plugins →</strong></a> ·
  <a href="docs/ARCHITECTURE.md"><strong>How it works →</strong></a> ·
  <a href="https://discord.gg/ai-driven-dev"><strong>Join Discord →</strong></a>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://www.conventionalcommits.org/)
[![Git hooks: lefthook](https://img.shields.io/badge/git%20hooks-lefthook-007ACC.svg)](https://lefthook.dev/)
[![Built for Claude Code](https://img.shields.io/badge/built%20for-Claude%20Code-D97757.svg)](https://code.claude.com/docs/en/discover-plugins)
[![Maintained](https://img.shields.io/badge/maintained-yes-success.svg)](https://github.com/ai-driven-dev/aidd-framework/commits/main)
[![Made in France](https://img.shields.io/badge/made%20in-France-0055A4?labelColor=EF4135)](https://www.ai-driven-dev.fr/)

<!-- TODO: re-enable these badges when the repo goes public; both shields.io and the GitHub Actions badge endpoint return "not found" while the repo is private:
[![Latest Release](https://img.shields.io/github/v/release/ai-driven-dev/aidd-framework?include_prereleases&sort=semver)](https://github.com/ai-driven-dev/aidd-framework/releases)
[![CI](https://github.com/ai-driven-dev/aidd-framework/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ai-driven-dev/aidd-framework/actions/workflows/ci.yml)
-->

</div>

---

## What is AI-Driven Dev?

[AI-Driven Dev](https://www.ai-driven-dev.fr/) (AIDD) is a community that proposes a development flow and a set of tools built around the AI-Driven Development methodology. The flow covers the full SDLC under rigorous human supervision; the tools are the skills, agents, rules, and conventions that make that flow concrete inside an AI coding assistant. This repository is the Claude Code distribution of that toolset.

Founded by Alex Soyes - [Blog](https://alexsoyes.com/) · [GitHub](https://github.com/alexsoyes) · [LinkedIn](https://www.linkedin.com/in/alexsoyes/) · [X](https://x.com/alexsoyes).

Join the conversation: [Discord](https://discord.gg/ai-driven-dev) · [YouTube](https://www.youtube.com/@aidd_off) · [LinkedIn](https://www.linkedin.com/company/ai-driven-dev) · [Website](https://www.ai-driven-dev.fr/)

---

## Prerequisites

To consume the marketplace from any Claude Code session you need:

- **Claude Code** installed and running (`/plugin` slash command available). Recent versions support marketplaces; if `/plugin marketplace add` is unknown, update Claude Code first.
- **An Anthropic plan or API key** -- a Claude Pro/Max plan for OAuth, or an `ANTHROPIC_API_KEY` for pay-per-token usage. Most plugins also work in interactive Claude Code sessions where the host already authenticates.
- **`gh` CLI authenticated** if you plan to use plugins that interact with GitHub (`aidd-vcs`, `aidd-orchestrator`, `aidd-pm`). Verify with `gh auth status`.
- **Network access** to GitHub (this repo is the marketplace) and to Anthropic API endpoints.
- **Optional per plugin**: some plugins assume additional context, such as a working git repo, a `package.json`, or a configured ticketing tool. Each plugin's README lists its own prerequisites.

## Quick start

Inside any Claude Code session, register this marketplace and install a plugin:

```text
/plugin marketplace add ai-driven-dev/aidd-framework
/plugin install aidd-context@aidd-framework
```

> The blocks above are Claude Code slash commands typed inside a Claude Code session, not shell commands.

If the marketplace repo is private, `/plugin marketplace add <owner>/<repo>` requires that you be authenticated with read access to that repo (typically via `gh auth login` or a PAT on the machine running Claude Code). See the Anthropic [Discover and install plugins](https://code.claude.com/docs/en/discover-plugins) docs for the full install flow.

Browse the plugin catalog below and install whichever plugins fit your workflow. The `aidd-context` plugin ships an onboarding skill - after installing it, run `Use skill aidd-context:00:onboard` for a guided tour of that plugin. The other plugins have no onboard skill; pick one from the table below, install it, and consult its README for the skills it owns. There is no cross-plugin tour today.

Prefer browsing inside Claude Code? Run `/plugin` and open the **Discover** tab once the marketplace is registered.

> Using **Cursor**, **GitHub Copilot**, or **OpenCode** instead? The cross-tool adapter [`aidd-cli`](https://github.com/ai-driven-dev/aidd-cli) packages the same skills for those assistants. Setup instructions live in that repo.

---

## Plugins

<table>
<tr>
<td width="33%" valign="top">

### 🧭 [aidd-context](plugins/aidd-context/README.md)

`7 skills` · stable

Project init, architecture, generation of Claude Code context artifacts (skills, agents, rules, commands, hooks, plugins, marketplaces), diagrams, learning, discovery.

</td>
<td width="33%" valign="top">

### ⚙️ [aidd-dev](plugins/aidd-dev/README.md)

`10 skills` · stable

SDLC loop: sdlc, plan, implement, assert, audit, review, test, refactor, debug, for-sure.

</td>
<td width="33%" valign="top">

### 🌿 [aidd-vcs](plugins/aidd-vcs/README.md)

`4 skills` · stable

Commits, pull / merge requests, release tags, issue creation.

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

Meta-cognition: brainstorm, challenge, condense, shadow-areas, fact-check.

</td>
<td width="33%" valign="top">

### 🎼 [aidd-orchestrator](plugins/aidd-orchestrator/README.md)

`1 skill` · stable (`async-dev`)

Label an issue, get a PR; re-label, get the review applied. Router-based skill: one entry point, three sub-flows (setup, run, review).

</td>
</tr>
</table>

Each plugin's README links to per-skill READMEs covering when to use, how to invoke, prerequisites, and outputs.

---

## How marketplaces work in Claude Code

A marketplace is a Git repository that publishes plugins. When you run `/plugin marketplace add <owner>/<repo>`, Claude Code clones the repo, reads its `.claude-plugin/marketplace.json`, and offers the plugins listed there for install.

`aidd-framework` is a **community-maintained, methodology-driven complement** to Anthropic's [official marketplace](https://github.com/anthropics/claude-plugins-official). The official catalog covers broadly useful plugins curated by Anthropic; AIDD ships plugins that materialise a specific way of working (the AI-Driven Development flow) inside Claude Code. The two are designed to coexist; you can register both and install plugins from either.

The official Anthropic documentation covers the full model:

- [Discover and install plugins](https://code.claude.com/docs/en/discover-plugins) - the user-facing flow
- [Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) - host your own
- [Plugins reference](https://code.claude.com/docs/en/plugins-reference) - manifest + marketplace.json schemas
- [Anthropic's official marketplace](https://github.com/anthropics/claude-plugins-official) - canonical example

### Scopes

Plugins can be installed at three different scopes:

| Scope     | Stored in                  | Lifetime         | Best for |
| --------- | -------------------------- | ---------------- | -------- |
| `user`    | `~/.claude/plugins/`       | All your projects| Personal toolbelt |
| `project` | `.claude/settings.json` (`enabledPlugins`) in the repo | This repo only | Team-shared setup |
| `local`   | A local directory          | This machine     | Plugin development |

Set scope at install time with the `/plugin` UI, or by editing `enabledPlugins` directly in `.claude/settings.json`.

---

## Versioning and updates

- Each plugin versions independently via `release-please`. Tags look like `aidd-<plugin>-vX.Y.Z`.
- The root marketplace (`marketplace.json`) versions independently as `vX.Y.Z`.
- Pull updates inside Claude Code with `/plugin marketplace update aidd-framework`.

See [`CHANGELOG.md`](./CHANGELOG.md) for the full history.

---

## Trust and safety

This is a community-maintained marketplace. Plugins can execute commands, edit files, and call external services on your behalf. Before installing any plugin from any third-party marketplace, including this one:

- Read its README and SKILL.md files.
- Inspect the action files under `actions/`.
- Check what permissions it requests in its hooks (`hooks/hooks.json`) and MCP servers (`.mcp.json`).

If you spot a vulnerability, please report it privately via [SECURITY.md](./SECURITY.md).

---

## Documentation

| Resource | Where |
| -------- | ----- |
| Architecture overview | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Skills catalog (all plugins) | [`docs/CATALOG.md`](docs/CATALOG.md) |
| Glossary | [`docs/GLOSSARY.md`](docs/GLOSSARY.md) |
| Build your own plugin | [`docs/CREATE_PLUGIN.md`](docs/CREATE_PLUGIN.md) |
| Frequently asked questions | [`docs/FAQ.md`](docs/FAQ.md) |
| Contribution guide | [`CONTRIBUTING.md`](./CONTRIBUTING.md) |
| Governance | [`GOVERNANCE.md`](./GOVERNANCE.md) |
| Roadmap | [`ROADMAP.md`](./ROADMAP.md) |
| Code of Conduct | [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) |
| Security policy | [`SECURITY.md`](./SECURITY.md) |
| Changelog | [`CHANGELOG.md`](./CHANGELOG.md) (see also [GitHub Releases](https://github.com/ai-driven-dev/aidd-framework/releases)) |
| Anthropic plugin docs | [code.claude.com/docs/en/plugins](https://code.claude.com/docs/en/plugins) |

Note: `aidd_docs/` and similar directories generated by `aidd-context:02:project-init` belong to user projects, not to this marketplace. Do not link them from framework-level documentation.

---

<details>
<summary><strong>LLM tier reference</strong> (used by skills that target a specific model tier)</summary>

Some skills target a specific model tier when they need a particular capability. Default tier per task type:

| Tier   | Label    | Example models           | Best for                                                          | Relative cost |
| ------ | -------- | ------------------------ | ----------------------------------------------------------------- | ------------- |
| **T1** | Fast     | Claude Haiku, Grok Fast  | Mechanical, deterministic tasks, templates, git operations        | 1x            |
| **T2** | Balanced | Claude Sonnet, GPT Codex | Implementation, structured analysis, validation, code generation  | 8x            |
| **T3** | Thinking | Claude Opus, GPT 5.2     | Deep reasoning, synthesis, planning, orchestration, onboarding    | 30x           |

</details>

---

## Troubleshooting

**The marketplace does not show my plugins after `/plugin marketplace add`** - run `/plugin marketplace update aidd-framework` to refresh the cache, then `/plugin` to browse the **Discover** tab.

**`/plugin install` says the plugin is unknown** - confirm the marketplace name matches the `name` field in `.claude-plugin/marketplace.json` of this repo (currently `aidd-framework`). The install command is `/plugin install <plugin-name>@aidd-framework`.

**My new plugin actions don't load** - run `/reload-plugins` in the same Claude Code session, or restart Claude Code if a hook config changed.

---

## Contributing

Pull requests are welcome. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the contribution flow, the commit scope discipline, and the templates each surface (skill, agent, rule, command) follows.

To build and ship a brand-new plugin through this marketplace, see [`docs/CREATE_PLUGIN.md`](docs/CREATE_PLUGIN.md).

By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

---

## Acknowledgements

- [Anthropic](https://www.anthropic.com/) for Claude Code, the plugin marketplace model, and the [`claude-code-action`](https://github.com/anthropics/claude-code-action) GitHub Action.
- [SchemaStore](https://www.schemastore.org/) for the canonical JSON schemas the lefthook hooks validate against.
- [lefthook](https://lefthook.dev/), [release-please](https://github.com/googleapis/release-please), and [Contributor Covenant](https://www.contributor-covenant.org/) for the OSS toolchain underneath.
- Everyone in the AIDD community who shares prompts, skills, and feedback. Without you this catalog would be empty.

---

<div align="center">

🇫🇷 🥖 🐓 · Made with care in France by the AIDD community · 🐓 🥖 🇫🇷

← [Back to the AIDD organisation](https://github.com/ai-driven-dev)

</div>
