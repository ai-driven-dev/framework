# AI-Driven Dev Framework (AIDD)

A plugin marketplace for AI-driven development. Install focused skill sets into your AI coding assistant.

---

## Plugins

| Plugin | Skills | Purpose |
|--------|--------|---------|
| [aidd-context](plugins/aidd-context/README.md) | 6 | Project init, architecture, context generation, diagrams, learning, discovery |
| [aidd-dev](plugins/aidd-dev/README.md) | 9 | SDLC loop: plan, assert, review, test, refactor, debug |
| [aidd-vcs](plugins/aidd-vcs/README.md) | 4 | Commits, pull/merge requests, release tags, issue creation |
| [aidd-pm](plugins/aidd-pm/README.md) | 4 | Ticket info, user stories, PRD, clarity mode (release candidate) |
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

← [Back to main repo](https://github.com/ai-driven-dev/aidd/blob/main/README.md)
