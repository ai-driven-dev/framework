<div align="center">

# AI-Driven Dev Framework

**A community-maintained marketplace of high-signal skills, agents, and rules for Claude Code, built around the AI-Driven Development methodology.**

6 plugins · 31 skills · MIT licensed

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://www.conventionalcommits.org/)
[![Git hooks: lefthook](https://img.shields.io/badge/git%20hooks-lefthook-007ACC.svg)](https://lefthook.dev/)
[![Built for Claude Code](https://img.shields.io/badge/built%20for-Claude%20Code-D97757.svg)](https://code.claude.com/docs/en/discover-plugins)
[![Maintained](https://img.shields.io/badge/maintained-yes-success.svg)](https://github.com/ai-driven-dev/aidd-framework/commits/main)

<!-- TODO: re-enable these badges when the repo goes public; both shields.io and the GitHub Actions badge endpoint return "not found" while the repo is private:
[![Latest Release](https://img.shields.io/github/v/release/ai-driven-dev/aidd-framework?include_prereleases&sort=semver)](https://github.com/ai-driven-dev/aidd-framework/releases)
[![CI](https://github.com/ai-driven-dev/aidd-framework/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ai-driven-dev/aidd-framework/actions/workflows/ci.yml)
-->

</div>

<!-- TODO: record a 30-60s demo (label an issue, watch a PR open) and embed as docs/demo.gif. LICEcap or QuickTime + ffmpeg work fine. -->

---

## What is AI-Driven Dev?

[AI-Driven Dev](https://www.ai-driven-dev.fr/) (AIDD) is a community that proposes a development flow and a set of tools built around the AI-Driven Development methodology. The flow covers the full SDLC under rigorous human supervision; the tools are the skills, agents, rules, and conventions that make that flow concrete inside an AI coding assistant. This repository is the Claude Code distribution of that toolset.

Founded by [Alex Soyes](https://www.youtube.com/@alexsoyes).

Join the conversation: [Discord](https://discord.gg/ai-driven-dev) · [YouTube](https://www.youtube.com/@aidd_off) · [LinkedIn](https://www.linkedin.com/company/ai-driven-dev) · [Website](https://www.ai-driven-dev.fr/)

---

## Quick start

Inside any Claude Code session, register this marketplace and install a plugin:

```text
/plugin marketplace add ai-driven-dev/aidd-framework
/plugin install aidd-dev@aidd-framework
```

That's it. The first command registers `aidd-framework` as a marketplace; the second installs the `aidd-dev` plugin from it. Repeat the `install` line for any other plugin from the catalog below.

Prefer browsing? Run `/plugin` inside Claude Code and open the **Discover** tab once the marketplace is registered.

> Using **Cursor**, **GitHub Copilot**, or **OpenCode** instead? The cross-tool adapter [`aidd-cli`](https://github.com/ai-driven-dev/aidd-cli) packages the same skills for those assistants. Setup instructions live in that repo.

---

## Plugins

| Plugin | Skills | What it does |
| ------ | ------ | ------------ |
| [aidd-context](plugins/aidd-context/README.md) | 7 | Project init, architecture, context generation, diagrams, learning, discovery |
| [aidd-dev](plugins/aidd-dev/README.md) | 10 | SDLC loop: plan, implement, assert, review, test, refactor, debug |
| [aidd-vcs](plugins/aidd-vcs/README.md) | 4 | Commits, pull/merge requests, release tags, issue creation |
| [aidd-pm](plugins/aidd-pm/README.md) | 4 | Ticket info, user stories, PRD, spec drafting (release candidate) |
| [aidd-orchestrator](plugins/aidd-orchestrator/README.md) | 3 | Orchestration use cases: `async-dev` (label an issue, get a PR) |
| [aidd-refine](plugins/aidd-refine/README.md) | 3 | Meta-cognition: brainstorm, challenge, condense |

Each plugin's README links to per-skill READMEs covering when to use, how to invoke, prerequisites, and outputs.

---

## How marketplaces work in Claude Code

A marketplace is a Git repository that publishes plugins. When you run `/plugin marketplace add <owner>/<repo>`, Claude Code clones the repo, reads its `.claude-plugin/marketplace.json`, and offers the plugins listed there for install. The official Anthropic documentation covers the full model:

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
| Methodology, flow guide, conventions | [`aidd_docs/README.md`](aidd_docs/README.md) |
| Skills catalog (auto-generated) | [`aidd_docs/CATALOG.md`](aidd_docs/CATALOG.md) |
| Contribution guide | [`CONTRIBUTING.md`](./CONTRIBUTING.md) |
| Code of Conduct | [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) |
| Security policy | [`SECURITY.md`](./SECURITY.md) |
| Anthropic plugin docs | [code.claude.com/docs/en/plugins](https://code.claude.com/docs/en/plugins) |

---

## LLM tier reference

Some skills target a specific model tier when they need a particular capability. Default tier per task type:

| Tier   | Label    | Example models           | Best for                                                          | Relative cost |
| ------ | -------- | ------------------------ | ----------------------------------------------------------------- | ------------- |
| **T1** | Fast     | Claude Haiku, Grok Fast  | Mechanical, deterministic tasks, templates, git operations        | 1x            |
| **T2** | Balanced | Claude Sonnet, GPT Codex | Implementation, structured analysis, validation, code generation  | 8x            |
| **T3** | Thinking | Claude Opus, GPT 5.2     | Deep reasoning, synthesis, planning, orchestration, onboarding    | 30x           |

---

## Troubleshooting

**The marketplace does not show my plugins after `/plugin marketplace add`** - run `/plugin marketplace update aidd-framework` to refresh the cache, then `/plugin` to browse the **Discover** tab.

**`/plugin install` says the plugin is unknown** - confirm the marketplace name matches the `name` field in `.claude-plugin/marketplace.json` of this repo (currently `aidd-framework`). The install command is `/plugin install <plugin-name>@aidd-framework`.

**My new plugin actions don't load** - run `/reload-plugins` in the same Claude Code session, or restart Claude Code if a hook config changed.

---

## Contributing

Pull requests are welcome. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the contribution flow, the commit scope discipline, and the templates each surface (skill, agent, rule, command) follows.

By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

---

← [Back to the AIDD organisation](https://github.com/ai-driven-dev)
