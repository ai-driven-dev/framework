# AIDD Framework Catalog

Auto-generated framework content: agents, commands, rules, skills, and templates.

> This file is automatically updated by the `scripts/summarize-markdown.mjs` script.

## Table of Contents

- [`.claude-plugin`](#claude-plugin)
- [`.vscode`](#vscode)
- [`aidd_docs`](#aidd_docs)
- [`plugins`](#plugins)
  - [`plugins/aidd-context`](#pluginsaidd-context)
  - [`plugins/aidd-dev`](#pluginsaidd-dev)
  - [`plugins/aidd-pm`](#pluginsaidd-pm)
  - [`plugins/aidd-vcs`](#pluginsaidd-vcs)
- [`scripts`](#scripts)

---

### `.claude-plugin`

| File |
|------|
| [marketplace.json](../.claude-plugin/marketplace.json) |

### `.vscode`

| File |
|------|
| [settings.json](../.vscode/settings.json) |

### `aidd_docs`

| File |
|------|
| [CATALOG.md](CATALOG.md) |

### `plugins`

#### `plugins/aidd-context`

| Group | File |
|-------|------|
| `.claude-plugin` | [plugin.json](../plugins/aidd-context/.claude-plugin/plugin.json) |
| `-` | [CATALOG.md](../plugins/aidd-context/CATALOG.md) |
| `hooks` | [hooks.json](../plugins/aidd-context/hooks/hooks.json) |
| `hooks` | [update_memory.js](../plugins/aidd-context/hooks/update_memory.js) |
| `-` | [README.md](../plugins/aidd-context/README.md) |
| `-` | [version.txt](../plugins/aidd-context/version.txt) |

#### `plugins/aidd-dev`

| Group | File | Description |
|-------|------|---|
| `.claude-plugin` | [plugin.json](../plugins/aidd-dev/.claude-plugin/plugin.json) | - |
| `-` | [.mcp.json](../plugins/aidd-dev/.mcp.json) | - |
| `agents` | [implementer.md](../plugins/aidd-dev/agents/implementer.md) | `Milestone executor. Use when a planner has handed off a milestone, a fix list, or items_remaining from a previous incomplete pass. Codes, tests, repairs. Returns what's done, what's remaining, and a completion score. Never replans, never judges.` |
| `agents` | [iris.md](../plugins/aidd-dev/agents/iris.md) | `Frontend specialist with 3 modes - implement from Figma, verify UI conformity, validate user journeys.` |
| `agents` | [martin.md](../plugins/aidd-dev/agents/martin.md) | `Every time you need to run a command to ensure code is correct, still builds are that tests pass, you must call this agent.` |
| `agents` | [planner.md](../plugins/aidd-dev/agents/planner.md) | `Orchestrator. Use when a new spec must be turned into an executable plan, when an agent returned with completion_score < 100%, when a reviewer surfaced quality issues, or when a human requests a replan. Spawns implementer and reviewer in fresh contexts. Never writes code, never judges code.` |
| `agents` | [reviewer.md](../plugins/aidd-dev/agents/reviewer.md) | `Independent critic in fresh context. Use when an artifact (code, spec, plan, doc) needs verification against a validator (acceptance criteria, checklist file, or any explicit ruleset). Returns reviewed items, findings, completion score and quality score. Never edits the artifact, never decides what to do next.` |
| `-` | [CATALOG.md](../plugins/aidd-dev/CATALOG.md) | - |
| `-` | [README.md](../plugins/aidd-dev/README.md) | - |
| `-` | [version.txt](../plugins/aidd-dev/version.txt) | - |

#### `plugins/aidd-pm`

| Group | File |
|-------|------|
| `.claude-plugin` | [plugin.json](../plugins/aidd-pm/.claude-plugin/plugin.json) |
| `-` | [.mcp.json](../plugins/aidd-pm/.mcp.json) |
| `-` | [CATALOG.md](../plugins/aidd-pm/CATALOG.md) |
| `-` | [README.md](../plugins/aidd-pm/README.md) |
| `-` | [version.txt](../plugins/aidd-pm/version.txt) |

#### `plugins/aidd-vcs`

| Group | File |
|-------|------|
| `.claude-plugin` | [plugin.json](../plugins/aidd-vcs/.claude-plugin/plugin.json) |
| `-` | [CATALOG.md](../plugins/aidd-vcs/CATALOG.md) |
| `-` | [README.md](../plugins/aidd-vcs/README.md) |
| `-` | [version.txt](../plugins/aidd-vcs/version.txt) |

### `scripts`

| File |
|------|
| [aidd.sh](../scripts/aidd.sh) |

