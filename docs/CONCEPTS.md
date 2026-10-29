# Concepts

The words this framework uses, and how project memory works. Read top to bottom once; use it as a reference after that.

## Building blocks

| Term | Meaning |
| --- | --- |
| Plugin | A package under `plugins/<name>/` that owns one concern. It groups skills with optional agents, commands, hooks and MCP configuration. Its README explains usage; the [catalog](CATALOG.md) lists what it contains. |
| Marketplace | A Git repository that publishes plugins. Your tool reads `.claude-plugin/marketplace.json` and offers the listed plugins. This repository is one. |
| Skill | A workflow under `plugins/<plugin>/skills/<NN-name>/`. You start it with a slash command or a trigger phrase. Its id is `<plugin>:<folder>`, for example `aidd-context:00-onboard`. |
| Router | The shape of every skill. `SKILL.md` lists the actions and the order they run in, and holds no business logic. |
| Action | One step of a skill, stored in its `actions/` folder, with its input, output, process and test. You never call an action directly. |
| Agent | A specialist role in `agents/<name>.md` that works in its own context and returns only a result. A skill or orchestrator starts it when a step needs isolation. |
| Command | A single prompt you invoke as a slash command. Use a skill instead when the work has several steps. |
| Rule | A coding standard the tool loads on its own, in its rules folder (`.claude/rules/` for Claude Code). In Claude Code, a `paths:` glob limits it to some files. Rules say how to write code; skills say what to do. |
| Hook | A program declared in `hooks/hooks.json` that your AI tool runs at a session event such as `SessionStart`. It is not a Git hook: Git's pre-commit runs when you commit, outside any AI session. |
| Bracket ID | The short label in a plugin README's skill table, such as `[2.1]` for `aidd-dev:01-plan`. The first number is the plugin. The second is the skill's position in that plugin's table, which is not always its folder number. |

How these parts fit together: [Architecture](ARCHITECTURE.md).

## Project memory

Project memory is a set of Markdown files in `aidd_docs/memory/`. The AI reads them at the start of a session, so it does not have to rediscover your project each time.

```text
aidd_docs/
├── README.md                    copied as is
├── GUIDELINES.md, CONTRIBUTING.md   yours: you fill in the placeholders
└── memory/
    ├── <topic>.md          one file per concern, written and refreshed by the AI
    ├── internal/           workflow notes, read when a task needs them
    └── external/           outside references (specs, design docs), read when you ask
```

### What goes in

- A first set of files describes every project: brief, architecture, codebase map, coding assertions, testing and version control.
- More files appear when the project needs them: backlog, ecosystem, API, database, deployment, CLI, UI and so on.
- Each file records the big picture and what the code cannot tell you. It points to the code instead of copying it.

### How it loads

| Part | Loaded |
| --- | --- |
| `memory/<topic>.md` | Every session, through a block in your tool's context file (`CLAUDE.md`, `AGENTS.md` or Copilot's instructions file) |
| `memory/internal/` | When the task needs it |
| `memory/external/` | When you ask |

A hook refreshes the block that `02-project-memory` wired in at session start, so new memory files are picked up on their own. It needs `node` on your `PATH`.

### Who writes it

| Command | Does |
| --- | --- |
| `/aidd-context:02-project-memory` (or `setup`) | Scans the project, writes the memory, wires it into your tools |
| `/aidd-context:02-project-memory refresh` | Shows what drifted, then updates the files you approve |
| `/aidd-context:02-project-memory rewire` | Only re-wires the block into your tools |
| `/aidd-context:10-learn` | Records a lasting decision or lesson, for example under `internal/decisions/` |

An existing file changes only through edits you approved. If you edit a file by hand, keep it to one concern, current state only, with no personal notes or to-do items.
