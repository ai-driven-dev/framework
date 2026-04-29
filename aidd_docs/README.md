# AI-Driven Dev — Documentation

AIDD is a plugin marketplace for AI-driven development. Each plugin delivers a focused set of skills installed into your AI coding assistant.

- [Plugins](#plugins)
- [Install](#install)
- [Skills catalog](#skills-catalog)

---

## Plugins

| Plugin | Purpose |
|--------|---------|
| [aidd-context](https://github.com/ai-driven-dev/aidd-framework/blob/main/plugins/aidd-context/README.md) | Knowledge production — project init, architecture, brainstorming, diagrams, discovery |
| [aidd-dev](https://github.com/ai-driven-dev/aidd-framework/blob/main/plugins/aidd-dev/README.md) | Code transformation — full SDLC loop with planning, assertions, review, testing, debugging |
| [aidd-vcs](https://github.com/ai-driven-dev/aidd-framework/blob/main/plugins/aidd-vcs/README.md) | VCS workflows — commits, pull/merge requests, release tags, issue creation |
| [aidd-pm](https://github.com/ai-driven-dev/aidd-framework/blob/main/plugins/aidd-pm/README.md) | Product management — ticket info, user stories, PRD (release candidate) |

---

## Install

Install a plugin into your project for a specific AI tool:

```bash
aidd plugin add aidd-dev --tool claude
```

Install all recommended plugins:

```bash
aidd plugin add --recommended --tool claude
```

Supported tools: `claude`, `cursor`, `copilot`, `opencode`.

Each plugin installs its skills into the tool-specific directory and registers any MCP servers.

---

## Skills catalog

See [CATALOG.md](CATALOG.md) for the full list of skills across all plugins.

Quick reference:

| Plugin | Skills |
|--------|--------|
| aidd-context | [1.1] project-init, [1.2] architecture-generate, [1.3] context-generate, [1.4] brainstorm, [1.5] challenge, [1.6] mermaid, [1.7] learn, [1.8] discovery |
| aidd-dev | [2.0] sdlc, [2.1] plan, [2.2] assert, [2.3] audit, [2.4] review, [2.5] test, [2.6] refactor, [2.7] debug, [2.8] for-sure |
| aidd-vcs | [3.1] commit, [3.2] pull-request, [3.3] release-tag, [3.4] issue-create |
| aidd-pm | [4.1] ticket-info, [4.2] user-stories-create, [4.3] prd |

---

See [CONTRIBUTING.md](CONTRIBUTING.md) to add or modify plugins and skills.
