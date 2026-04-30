# AIDD Framework Catalog

Auto-generated framework content: agents, commands, rules, skills, and templates.

> This file is automatically updated by the `scripts/summarize-markdown.mjs` script.

## Table of Contents

- [`.claude-plugin`](#claude-plugin)
- [`.vscode`](#vscode)
- [`aidd_docs`](#aidd_docs)
  - [`aidd_docs/memory`](#aidd_docsmemory)
  - [`aidd_docs/tasks`](#aidd_docstasks)
- [`plugins`](#plugins)
  - [`plugins/aidd-context`](#pluginsaidd-context)
  - [`plugins/aidd-dev`](#pluginsaidd-dev)
  - [`plugins/aidd-pm`](#pluginsaidd-pm)
  - [`plugins/aidd-vcs`](#pluginsaidd-vcs)
- [`rules`](#rules)
  - [`rules/04-tooling`](#rules04-tooling)
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
| [CONTRIBUTING.md](CONTRIBUTING.md) |
| [GUIDELINES.md](GUIDELINES.md) |
| [README.md](README.md) |

#### `aidd_docs/memory`

| File |
|------|
| [build-sketch.md](memory/build-sketch.md) |
| [cli-coordination.md](memory/cli-coordination.md) |
| [command-inventory.md](memory/command-inventory.md) |
| [mcp-merge-behavior.md](memory/mcp-merge-behavior.md) |
| [phase0-confidence.md](memory/phase0-confidence.md) |
| [pilot-aidd-vcs.md](memory/pilot-aidd-vcs.md) |
| [pre-existing-hook-failures.md](memory/pre-existing-hook-failures.md) |
| [release-please-sketch.md](memory/release-please-sketch.md) |
| [sample-hooks.json](memory/sample-hooks.json) |
| [spike-bracket-paths.md](memory/spike-bracket-paths.md) |
| [template-audit.md](memory/template-audit.md) |

#### `aidd_docs/tasks`

| Group | File |
|-------|------|
| `2026_04` | [2026_04_29-#260-plugin-architecture-part-8.md](tasks/2026_04/2026_04_29-#260-plugin-architecture-part-8.md) |

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

| Group | File | Description | Docs |
|-------|------|---|---|
| `.claude-plugin` | [plugin.json](../plugins/aidd-dev/.claude-plugin/plugin.json) | - | - |
| `-` | [.mcp.json](../plugins/aidd-dev/.mcp.json) | - | - |
| `agents` | [alexia.md](../plugins/aidd-dev/agents/alexia.md) | `Act like the USER to autonomously do the asked task without human intervention` | - |
| `agents` | [claire.md](../plugins/aidd-dev/agents/claire.md) | `Clarity challenger — challenges and questions until the request is ultra-clear` | - |
| `agents` | [iris.md](../plugins/aidd-dev/agents/iris.md) | `Frontend specialist with 3 modes - implement from Figma, verify UI conformity, validate user journeys.` | - |
| `agents` | [kent.md](../plugins/aidd-dev/agents/kent.md) | `Use this agent when explicitly asked to perform test-driven development.` | `https://tidyfirst.substack.com/p/augmented-coding-beyond-the-vibes` |
| `agents` | [martin.md](../plugins/aidd-dev/agents/martin.md) | `Every time you need to run a command to ensure code is correct, still builds are that tests pass, you must call this agent.` | - |
| `-` | [CATALOG.md](../plugins/aidd-dev/CATALOG.md) | - | - |
| `-` | [README.md](../plugins/aidd-dev/README.md) | - | - |
| `-` | [version.txt](../plugins/aidd-dev/version.txt) | - | - |

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

### `rules`

#### `rules/04-tooling`

| File | Description |
|------|---|
| [ide-mapping.claude.md](../rules/04-tooling/ide-mapping.claude.md) | `Claude Code file locations, syntax, frontmatter, and include patterns reference. Apply when creating or configuring Claude-specific files.` |
| [ide-mapping.codex.md](../rules/04-tooling/ide-mapping.codex.md) | `Codex CLI file locations, path mapping, and AIDD install-time @path expansion. Apply when creating or configuring Codex-specific files.` |
| [ide-mapping.copilot.md](../rules/04-tooling/ide-mapping.copilot.md) | `GitHub Copilot file locations, syntax, frontmatter, and instruction patterns reference. Apply when creating or configuring Copilot-specific files.` |
| [ide-mapping.cursor.md](../rules/04-tooling/ide-mapping.cursor.md) | `Cursor file locations, syntax, frontmatter, and rule patterns reference. Apply when creating or configuring Cursor-specific files.` |
| [ide-mapping.opencode.md](../rules/04-tooling/ide-mapping.opencode.md) | `OpenCode file locations, syntax, frontmatter, and configuration reference. Apply when creating or configuring OpenCode-specific files.` |

### `scripts`

| File |
|------|
| [aidd.sh](../scripts/aidd.sh) |
| [build-dist.sh](../scripts/build-dist.sh) |

