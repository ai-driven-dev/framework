# AI-Driven Dev Framework (AIDD)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/ai-driven-dev/aidd-framework?include_prereleases&sort=semver)](https://github.com/ai-driven-dev/aidd-framework/releases)
[![CI](https://github.com/ai-driven-dev/aidd-framework/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ai-driven-dev/aidd-framework/actions/workflows/ci.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A plugin marketplace for AI-driven development. Install focused skill sets into your AI coding assistant.

<!-- TODO: record a 30-60s demo (label issue -> workflow runs -> PR opens) and embed as docs/demo.gif. Use asciinema + agg, QuickTime + ffmpeg, or LICEcap. -->

---

## Plugins

| Plugin | Skills | Purpose |
|--------|--------|---------|
| [aidd-context](plugins/aidd-context/README.md) | 6 | Project init, architecture, context generation, diagrams, learning, discovery |
| [aidd-dev](plugins/aidd-dev/README.md) | 9 | SDLC loop: plan, assert, review, test, refactor, debug |
| [aidd-vcs](plugins/aidd-vcs/README.md) | 4 | Commits, pull/merge requests, release tags, issue creation |
| [aidd-pm](plugins/aidd-pm/README.md) | 4 | Ticket info, user stories, PRD, clarity mode (release candidate) |
| [aidd-orchestrator](plugins/aidd-orchestrator/README.md) | 3 | Orchestration use cases: `async-dev` (label-driven issue → PR, with review loop) |
| [aidd-refine](plugins/aidd-refine/README.md) | 3 | Meta-cognition: brainstorm, challenge, condense |

---

## Install

```bash
# Install a single plugin
aidd plugin add aidd-dev --tool claude

# Install all recommended plugins
aidd plugin add --recommended --tool claude
```

Supported tools: `claude`, `cursor`, `copilot`, `opencode`.

---

## Documentation

Full documentation, flow guide, and skill catalog: [aidd_docs/README.md](aidd_docs/README.md)

Skills catalog: [aidd_docs/CATALOG.md](aidd_docs/CATALOG.md)

---

## 🧠 LLM Tiers

| Tier   | Label        | Example Models           | Usage                                                            | Relative Cost |
| ------ | ------------ | ------------------------ | ---------------------------------------------------------------- | ------------- |
| **T1** | **Fast**     | Claude Haiku, Grok Fast  | Mechanical, deterministic tasks, templates, git ops              | 1x            |
| **T2** | **Balanced** | Claude Sonnet, GPT Codex | Implementation, structured analysis, validation, code generation | 8x            |
| **T3** | **Thinking** | Claude Opus, GPT 5.2     | Deep reasoning, synthesis, planning, orchestration, onboarding   | 30x           |

---

## 👌 Contributing

To add or modify elements (agents, commands, rules, skills, or templates), see the [contribution guide](./CONTRIBUTING.md).

By participating you agree to our [Code of Conduct](./CODE_OF_CONDUCT.md). For security issues, see [SECURITY.md](./SECURITY.md).

## Contributors

<a href="https://github.com/ai-driven-dev/aidd-framework/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ai-driven-dev/aidd-framework" alt="aidd-framework contributors" />
</a>

← [Back to main repo](https://github.com/ai-driven-dev/aidd/blob/main/README.md)
