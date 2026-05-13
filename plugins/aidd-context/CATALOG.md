# aidd-context catalog

Auto-generated index of skills, agents, references and assets shipped by the `aidd-context` plugin.

> This file is automatically updated by the `scripts/summarize-markdown.mjs` script.

## Table of Contents

- [`.claude-plugin`](#claude-plugin)
- [`hooks`](#hooks)
- [`skills`](#skills)
  - [`skills/00-onboard`](#skills00-onboard)
  - [`skills/01-bootstrap`](#skills01-bootstrap)
  - [`skills/02-project-init`](#skills02-project-init)
  - [`skills/03-context-generate`](#skills03-context-generate)
  - [`skills/04-mermaid`](#skills04-mermaid)
  - [`skills/05-learn`](#skills05-learn)
  - [`skills/06-discovery`](#skills06-discovery)

---

### `.claude-plugin`

| File |
|------|
| [plugin.json](.claude-plugin/plugin.json) |

### `hooks`

| File |
|------|
| [hooks.json](hooks/hooks.json) |
| [update_memory.js](hooks/update_memory.js) |

### `skills`

#### `skills/00-onboard`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-detect-state.md](skills/00-onboard/actions/01-detect-state.md) | - |
| `actions` | [02-recommend-next.md](skills/00-onboard/actions/02-recommend-next.md) | - |
| `actions` | [03-execute-or-handoff.md](skills/00-onboard/actions/03-execute-or-handoff.md) | - |
| `assets` | [state-matrix.md](skills/00-onboard/assets/state-matrix.md) | - |
| `evals` | [scenarios.json](skills/00-onboard/evals/scenarios.json) | - |
| `-` | [SKILL.md](skills/00-onboard/SKILL.md) | `Detect the project's aidd-context state and guide the user to one concrete next aidd-context action through a state -> recommend -> execute loop. Use when the user says "where do I start", "I'm new to this plugin", "onboard me", "what should I run next", "guide me through aidd-context", or invokes `aidd-context:00:onboard`. Do NOT use to enumerate every installed skill from raw user intent (a dedicated discovery skill in this plugin handles that), and do NOT use to teach the global cross-plugin AIDD flow (a separate cross-plugin onboard owns that scope).` |

#### `skills/01-bootstrap`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-gather-needs.md](skills/01-bootstrap/actions/01-gather-needs.md) | - |
| `actions` | [02-propose-candidates.md](skills/01-bootstrap/actions/02-propose-candidates.md) | - |
| `actions` | [03-audit-candidates.md](skills/01-bootstrap/actions/03-audit-candidates.md) | - |
| `actions` | [04-pick-and-design.md](skills/01-bootstrap/actions/04-pick-and-design.md) | - |
| `actions` | [05-write-install-md.md](skills/01-bootstrap/actions/05-write-install-md.md) | - |
| `assets` | [checklist.md](skills/01-bootstrap/assets/checklist.md) | - |
| `assets` | [install-template.md](skills/01-bootstrap/assets/install-template.md) | - |
| `evals` | [scenarios.json](skills/01-bootstrap/evals/scenarios.json) | - |
| `references` | [stack-heuristics.md](skills/01-bootstrap/references/stack-heuristics.md) | - |
| `-` | [SKILL.md](skills/01-bootstrap/SKILL.md) | `Imagine and validate the technical architecture of a new SaaS through interactive Q&A, candidate-stack comparison, multi-agent audit, and an INSTALL.md output. Use when starting a new SaaS project, choosing a stack, designing the architecture pattern (monolith vs microservices vs serverless), or producing a project's INSTALL.md. Do NOT use for editing an existing project's stack, database schema design, or scaffolding actual files (this skill produces docs only, no code).` |

#### `skills/02-project-init`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-init-context-file.md](skills/02-project-init/actions/01-init-context-file.md) | - |
| `actions` | [02-scaffold-docs.md](skills/02-project-init/actions/02-scaffold-docs.md) | - |
| `actions` | [03-generate-memory.md](skills/02-project-init/actions/03-generate-memory.md) | - |
| `actions` | [04-review-memory.md](skills/02-project-init/actions/04-review-memory.md) | - |
| `actions` | [05-sync-memory.md](skills/02-project-init/actions/05-sync-memory.md) | - |
| `assets` | [AGENTS.md](skills/02-project-init/assets/AGENTS.md) | `AI agent configuration and guidelines` |
| `assets` | [CONTRIBUTING.md](skills/02-project-init/assets/CONTRIBUTING.md) | - |
| `assets` | [golden-principles.md](skills/02-project-init/assets/golden-principles.md) | - |
| `assets` | [GUIDELINES.md](skills/02-project-init/assets/GUIDELINES.md) | - |
| `assets` | [README.md](skills/02-project-init/assets/README.md) | - |
| `evals` | [scenarios.json](skills/02-project-init/evals/scenarios.json) | - |
| `references` | [mapping-ai-context-file.md](skills/02-project-init/references/mapping-ai-context-file.md) | - |
| `-` | [SKILL.md](skills/02-project-init/SKILL.md) | `Initialize or refresh the project memory bank and ensure AI context files contain the project memory block. Use when running `aidd init` for the first time, bootstrapping a new project, or re-running the init flow on an existing project. Do NOT use for updating individual memory files after they exist - use `aidd-context:05:learn` instead; do NOT use for editing a single rule - edit the file directly.` |

#### `skills/03-context-generate`

| Group | File | Description |
|-------|------|---|
| `evals` | [scenarios.json](skills/03-context-generate/evals/scenarios.json) | - |
| `references` | [agents-coordination.md](skills/03-context-generate/references/agents-coordination.md) | `Multi-agent coordination and workflows template` |
| `references` | [ai-mapping.md](skills/03-context-generate/references/ai-mapping.md) | - |
| `references` | [naming-conventions.md](skills/03-context-generate/references/naming-conventions.md) | - |
| `references` | [rule-structure.md](skills/03-context-generate/references/rule-structure.md) | - |
| `references` | [rule-writing.md](skills/03-context-generate/references/rule-writing.md) | - |
| `references` | [skill-structure.md](skills/03-context-generate/references/skill-structure.md) | - |
| `-` | [SKILL.md](skills/03-context-generate/SKILL.md) | `Generate Claude Code context artifacts - skills (router-based: SKILL.md + atomic testable actions + minimal evals), agents, and rules. Use when the user wants to create, refactor, add or remove actions in a skill, migrate a slash command into a skill, or generate a new agent or rule. Do NOT use for editing a single action inside an existing skill (edit directly), creating slash commands (no router needed), writing MCP servers, or modifying project-level CLAUDE.md files.` |

#### `skills/04-mermaid`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-mermaid.md](skills/04-mermaid/actions/01-mermaid.md) | - |
| `evals` | [scenarios.json](skills/04-mermaid/evals/scenarios.json) | - |
| `references` | [mermaid-conventions.md](skills/04-mermaid/references/mermaid-conventions.md) | - |
| `-` | [SKILL.md](skills/04-mermaid/SKILL.md) | `Generate high-quality Mermaid diagrams from markdown content using a structured plan-validate workflow.` |

#### `skills/05-learn`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `actions` | [01-scope.md](skills/05-learn/actions/01-scope.md) | - | - |
| `actions` | [02-write.md](skills/05-learn/actions/02-write.md) | - | - |
| `actions` | [03-sync.md](skills/05-learn/actions/03-sync.md) | - | - |
| `assets` | [adr-template.md](skills/05-learn/assets/adr-template.md) | `Architecture Decision Record template` | - |
| `assets` | [decision-template.md](skills/05-learn/assets/decision-template.md) | `Individual decision record template` | `<title>` |
| `evals` | [scenarios.json](skills/05-learn/evals/scenarios.json) | - | - |
| `-` | [SKILL.md](skills/05-learn/SKILL.md) | `Capture and store project-level learnings, conventions, and decisions surfaced during work into memory, decisions, or rules. Use proactively when the user states a durable project rule or convention ("for next", "always do X", "from now on", "going forward", "rule:", "convention:"), records a technical decision and its rationale, deprecates something, or notes an insight that should outlive the current task. Do NOT use for personal or AI-preference reminders (those belong to user memory), routine code edits, minor fixes, or anything already captured.` | - |

#### `skills/06-discovery`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-find-skill.md](skills/06-discovery/actions/01-find-skill.md) | - |
| `actions` | [02-find-agent.md](skills/06-discovery/actions/02-find-agent.md) | - |
| `actions` | [03-find-command.md](skills/06-discovery/actions/03-find-command.md) | - |
| `actions` | [04-find-plugin.md](skills/06-discovery/actions/04-find-plugin.md) | - |
| `actions` | [05-find-mcp.md](skills/06-discovery/actions/05-find-mcp.md) | - |
| `evals` | [scenarios.json](skills/06-discovery/evals/scenarios.json) | - |
| `-` | [SKILL.md](skills/06-discovery/SKILL.md) | `Enumerate installed surfaces of the AI tool (skills, agents, commands, plugins, MCP servers) and recommend the best match for the user's stated intent. Use when the user asks "what's available?", "which skill/agent/command/plugin handles X?", "what MCPs are connected?", or wants a cross-plugin overview before picking a flow. Do NOT use for picking a specific item inside one plugin (the plugin's own onboard handles that), creating a new surface, or executing a recommended item (this skill only points; the user invokes).` |

