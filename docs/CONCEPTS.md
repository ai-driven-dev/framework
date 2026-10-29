# Concepts

## Building blocks

| Term | What it is |
| --- | --- |
| Marketplace | A catalog of plugins your AI tool can install from. This repository is one. |
| Plugin | An installable package for one concern, such as planning or version control. |
| Skill | A workflow you start with a slash command or a plain request, such as `aidd-context:00-onboard`. |
| Action | One step of a skill. You never call it directly. |
| Orchestrator | A skill that runs other skills for you, such as `aidd-orchestrator:01-sdlc`. |
| Agent | A specialist that works in its own context and returns only a result. |
| Command | A single prompt you run as a slash command. |
| Rule | A coding standard your tool loads on its own. |
| Hook | A program your tool runs at a session event, such as the start of a session. Not a Git hook. |
| Bracket ID | The label in a plugin README's skill table, such as `[2.1]`: the plugin, then the skill's row. |

How the parts fit together: [Architecture](ARCHITECTURE.md). The hooks that ship: [list](ARCHITECTURE.md#-bundled-hooks).

## Project memory

Markdown files in `aidd_docs/memory/` that your AI reads at the start of every session.

### Create it

Install the framework first: [install guide](INSTALL.md).

| Run | Does |
| --- | --- |
| `/aidd-context:02-project-memory setup` | Scans the project, writes the memory, wires it into your tools |
| `/aidd-context:02-project-memory refresh` | Shows what drifted, updates the files you approve |
| `/aidd-context:02-project-memory rewire` | Wires the memory into a tool again |
| `/aidd-context:10-learn` | Records a lasting decision or lesson |

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
- Each file holds the big picture and what the code cannot tell you.

### How it reaches your AI

- A block in your tool's context file points to the memory: `CLAUDE.md`, `AGENTS.md` or Copilot's instructions file.
- A hook refreshes that block at session start.
- The hook needs `node` on your `PATH`.

### Edit it by hand

- One concern per file.
- Current state only.
- No personal notes or to-dos.
