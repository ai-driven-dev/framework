# aidd-context catalog

Auto-generated index of skills, agents, references and assets shipped by the `aidd-context` plugin.

> This file is automatically updated by the `scripts/summarize-markdown.js` script.

## Table of Contents

- [`.claude-plugin`](#claude-plugin)
- [`hooks`](#hooks)
  - [`hooks/routing`](#hooksrouting)
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

#### `hooks/routing`

| Group | File |
|-------|------|
| `bin` | [build-index.js](hooks/routing/bin/build-index.js) |
| `bin` | [build-on-session.js](hooks/routing/bin/build-on-session.js) |
| `bin` | [eval.js](hooks/routing/bin/eval.js) |
| `bin` | [measure-follow-rate.js](hooks/routing/bin/measure-follow-rate.js) |
| `bin` | [test-prompts.js](hooks/routing/bin/test-prompts.js) |
| `lib` | [bm25.js](hooks/routing/lib/bm25.js) |
| `lib` | [paths.js](hooks/routing/lib/paths.js) |
| `lib` | [tokenize.js](hooks/routing/lib/tokenize.js) |
| `-` | [routing-hint.js](hooks/routing/routing-hint.js) |
| `tests` | [held-out-prompts.json](hooks/routing/tests/held-out-prompts.json) |

### `skills`

#### `skills/00-onboard`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-detect-state.md](skills/00-onboard/actions/01-detect-state.md) | - |
| `actions` | [02-recommend-next.md](skills/00-onboard/actions/02-recommend-next.md) | - |
| `actions` | [03-execute-or-handoff.md](skills/00-onboard/actions/03-execute-or-handoff.md) | - |
| `assets` | [state-matrix.md](skills/00-onboard/assets/state-matrix.md) | - |
| `evals` | [scenarios.json](skills/00-onboard/evals/scenarios.json) | - |
| `-` | [README.md](skills/00-onboard/README.md) | - |
| `-` | [SKILL.md](skills/00-onboard/SKILL.md) | `Detect the current project's state and open a hub of project actions - understand the project, set up or refresh the memory bank, or continue the AIDD development journey. Silently inspects the project, the AIDD setup, and which AIDD plugins are installed, then adapts the menu to that context. Use when the user says "where do I start", "onboard me", "onboard me to this project", "what should I run next", "what should I work on next", "what's the state of this project", "guide me through aidd", "guide me through aidd-context", or invokes `aidd-context:00:onboard`. Do NOT use to enumerate every installed surface from raw user intent (the discovery skill in this plugin handles that).` |

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
| `-` | [README.md](skills/01-bootstrap/README.md) | - |
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
| `-` | [README.md](skills/02-project-init/README.md) | - |
| `references` | [mapping-ai-context-file.md](skills/02-project-init/references/mapping-ai-context-file.md) | - |
| `-` | [SKILL.md](skills/02-project-init/SKILL.md) | `Initialize or refresh the project memory bank and ensure AI context files contain the project memory block. Use when running `aidd init` for the first time, bootstrapping a new project, or re-running the init flow on an existing project. Do NOT use for updating individual memory files after they exist - use `aidd-context:05:learn` instead; do NOT use for editing a single rule - edit the file directly.` |

#### `skills/03-context-generate`

| Group | File | Description |
|-------|------|---|
| `evals` | [scenarios.json](skills/03-context-generate/evals/scenarios.json) | - |
| `-` | [README.md](skills/03-context-generate/README.md) | - |
| `references` | [agents-coordination.md](skills/03-context-generate/references/agents-coordination.md) | `Multi-agent coordination and workflows template` |
| `references` | [ai-mapping.md](skills/03-context-generate/references/ai-mapping.md) | - |
| `references` | [hook.md](skills/03-context-generate/references/hook.md) | - |
| `references` | [marketplace.md](skills/03-context-generate/references/marketplace.md) | - |
| `references` | [naming-conventions.md](skills/03-context-generate/references/naming-conventions.md) | - |
| `references` | [plugin-manifest.md](skills/03-context-generate/references/plugin-manifest.md) | - |
| `references` | [rule-structure.md](skills/03-context-generate/references/rule-structure.md) | - |
| `references` | [rule-writing.md](skills/03-context-generate/references/rule-writing.md) | - |
| `references` | [skill-structure.md](skills/03-context-generate/references/skill-structure.md) | - |
| `references` | [slash-command.md](skills/03-context-generate/references/slash-command.md) | - |
| `references` | [tool-resolution.md](skills/03-context-generate/references/tool-resolution.md) | - |
| `-` | [SKILL.md](skills/03-context-generate/SKILL.md) | `Generate context artifacts (skills, agents, rules, commands, hooks, plugins, marketplaces) across the host AI tool(s) the project uses. Detects installed tools, proposes the target set, and the user confirms before writing. Use when the user wants to create, refactor, add or remove actions in a skill, migrate a legacy slash command into a router-based skill, or generate a new agent, rule, command, hook, plugin, or marketplace. Do NOT use for editing a single action inside an existing skill (edit directly), writing MCP servers, or modifying project-level files.` |

#### `skills/04-mermaid`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-mermaid.md](skills/04-mermaid/actions/01-mermaid.md) | - |
| `evals` | [scenarios.json](skills/04-mermaid/evals/scenarios.json) | - |
| `-` | [README.md](skills/04-mermaid/README.md) | - |
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
| `-` | [README.md](skills/05-learn/README.md) | - | - |
| `-` | [SKILL.md](skills/05-learn/SKILL.md) | `Capture and store project-level learnings, conventions, and decisions surfaced during work into memory, decisions, or rules. Use proactively when the user states a durable project rule or convention ("for next", "always do X", "from now on", "going forward", "rule:", "convention:"), records a technical decision and its rationale, deprecates something, or notes an insight that should outlive the current task. Do NOT use for personal or AI-preference reminders (those belong to user memory), routine code edits, minor fixes, or anything already captured.` | - |

#### `skills/06-discovery`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-find-skill.md](skills/06-discovery/actions/01-find-skill.md) | - |
| `actions` | [02-find-agent.md](skills/06-discovery/actions/02-find-agent.md) | - |
| `actions` | [03-find-command.md](skills/06-discovery/actions/03-find-command.md) | - |
| `actions` | [04-find-plugin.md](skills/06-discovery/actions/04-find-plugin.md) | - |
| `actions` | [05-find-mcp.md](skills/06-discovery/actions/05-find-mcp.md) | - |
| `actions` | [06-find-rule.md](skills/06-discovery/actions/06-find-rule.md) | - |
| `actions` | [07-find-hook.md](skills/06-discovery/actions/07-find-hook.md) | - |
| `actions` | [08-find-memory.md](skills/06-discovery/actions/08-find-memory.md) | - |
| `evals` | [scenarios.json](skills/06-discovery/evals/scenarios.json) | - |
| `-` | [README.md](skills/06-discovery/README.md) | - |
| `-` | [SKILL.md](skills/06-discovery/SKILL.md) | `Enumerate installed surfaces of the AI tool (skills, agents, commands, plugins, MCP servers, rules, hooks, memory files) and recommend the best match for the user's stated intent. Use proactively whenever the user asks the model to list, show, enumerate, find, or pick among any of these surfaces - including imperative phrasings ("list hooks", "show me the rules", "enumerate skills", "find a memory file", "which agent reviews code"), question phrasings ("what's available?", "what hooks do we have?", "which rule applies here?", "what memory files do we have?"), and indirect phrasings ("what can I use for X?", "do we have something that does Y?"). Always pick this skill over scanning the filesystem with grep, find, ls, or reading action files directly when the user is enumerating a surface. Do NOT use for picking a specific item inside one plugin (the plugin's own onboard handles that), creating a new surface, or executing a recommended item (this skill only points; the user invokes).` |

