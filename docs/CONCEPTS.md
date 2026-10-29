# Concepts

The words this framework uses, and how project memory works.

## Building blocks

**Marketplace.** A catalog of plugins that your AI tool can install from. This repository is one: your tool reads its list and offers the plugins.

**Plugin.** An installable package that owns one concern, such as planning or version control. It groups skills, and sometimes agents, hooks and rules. Each plugin has a README, and the [catalog](CATALOG.md) lists what it contains.

**Skill.** A workflow you start with a slash command or a plain request. Its name is `<plugin>:<skill>`, for example `aidd-context:00-onboard`. It is a router: it holds no logic and runs its actions in order.

**Action.** One step of a skill, with its input, output, process and test. You never call an action directly.

**Orchestrator.** A skill that drives other skills for you, such as `aidd-orchestrator:01-sdlc`, which takes a request to a draft pull request.

**Agent.** A specialist that works in its own context and returns only a result. A skill starts it when a step needs isolation, for example an independent reviewer.

**Command.** A single prompt you run as a slash command. Use a skill when the work has several steps.

**Rule.** A coding standard that your tool loads on its own. Rules say how to write code; skills say what to do.

**Hook.** A program your AI tool runs at a session event, such as the start of a session. It is not a Git hook. The ones that ship are listed in the [architecture](ARCHITECTURE.md#-bundled-hooks).

**Bracket ID.** The short label in a plugin README's skill table, such as `[2.1]`. The first number is the plugin, the second is the skill's row in that plugin.

How these parts fit together: [Architecture](ARCHITECTURE.md).

## Project memory

Project memory is a set of Markdown files in `aidd_docs/memory/`. Your AI reads them at the start of every session, so it does not have to rediscover your project each time.

### Create it

Install the framework first (see the [install guide](INSTALL.md)), then run:

| Command | Does |
| --- | --- |
| `/aidd-context:02-project-memory setup` | First time: scans the project, writes the memory, wires it into your tools |
| `/aidd-context:02-project-memory refresh` | Shows what drifted, then updates the files you approve |
| `/aidd-context:02-project-memory rewire` | Wires the memory into a tool again, without rewriting it |
| `/aidd-context:10-learn` | Records a lasting decision or lesson |

An existing file changes only through edits you approved.

### What goes in

```text
aidd_docs/
└── memory/
    ├── <topic>.md      one file per concern, loaded every session
    ├── internal/       workflow notes, loaded when a task needs them
    └── external/       outside references, loaded when you ask
```

- Every project gets a brief, the architecture, a codebase map, coding assertions, testing and version control.
- More files appear when the project needs them: backlog, deployment, API, database and so on.
- Each file holds the big picture and what the code cannot tell you. It points to the code instead of copying it.

### How it loads

A block in your tool's context file (`CLAUDE.md`, `AGENTS.md` or Copilot's instructions file) points to the memory files. A hook refreshes that block when a session starts, so new files are picked up on their own. It needs `node` on your `PATH`.

If you edit a file by hand, keep it to one concern and to the current state, with no personal notes or to-do items.
