# Concepts

## Building blocks

| Term | What it is |
| --- | --- |
| Marketplace | A catalog of plugins your AI tool can install from. This repository is one. |
| Plugin | An installable package for one concern, such as planning or version control. |
| Skill | A workflow you start with a slash command or a plain request, such as `aidd-context:00-onboard`. |
| Action | One step of a skill. You never call it directly. |
| Orchestrator | A skill that runs other skills for you, such as `aidd-orchestrator:01-sdlc`. |
| Subagent | A specialist that works in its own context and returns only a result. |
| Command | A single prompt you run as a slash command. |
| Rule | A coding standard your tool loads on its own. |
| Hook | A program your tool runs at a session event, such as the start of a session. Not a Git hook. |
| Project memory | Markdown files your AI reads at the start of every session. See below. |
| Recipe | A how-to sheet you follow with `aidd-context:12-cook`. |

## Project memory

### Create and refresh it

[Guides: memory](GUIDES.md#2-memory) and [update](GUIDES.md#6-update).

### What it holds

```text
aidd_docs/
└── memory/
    ├── <topic>.md      one file per concern
    ├── internal/       workflow notes
    └── external/       outside references
```

| Part | Loaded |
| --- | --- |
| `memory/<topic>.md` | Every session |
| `memory/internal/` | When a task needs it |
| `memory/external/` | When you ask |

- Every project gets a brief, the architecture, a codebase map, coding assertions, testing and version control.
- Other files appear when needed: backlog, deployment, API, database.

### How it reaches your AI

- A block in `CLAUDE.md` or `AGENTS.md` points to the memory.
- A hook refreshes that block at the start of each session.
