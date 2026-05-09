# aidd-context catalog

Auto-generated index of skills, agents, references and assets shipped by the `aidd-context` plugin.

> This file is automatically updated by the `scripts/summarize-markdown.mjs` script.

## Table of Contents

- [`.claude-plugin`](#claude-plugin)
- [`hooks`](#hooks)
- [`skills`](#skills)
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
| `-` | [SKILL.md](skills/01-bootstrap/SKILL.md) | `Imagine and validate the technical architecture of a new SaaS through interactive Q&A, candidate-stack comparison, multi-agent audit, and an INSTALL.md output. Use when starting a new SaaS project, choosing a stack, designing the architecture pattern (monolith vs microservices vs serverless), or producing a project's INSTALL.md. Do NOT use for editing an existing project's stack (use direct edits or `aidd-dev:01:plan`), database schema design, or scaffolding actual files (this skill produces docs only, no code).` |

#### `skills/02-project-init`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-init-context-file.md](skills/02-project-init/actions/01-init-context-file.md) | - |
| `actions` | [02-scaffold-docs.md](skills/02-project-init/actions/02-scaffold-docs.md) | - |
| `actions` | [03-generate-memory.md](skills/02-project-init/actions/03-generate-memory.md) | - |
| `actions` | [04-review-memory.md](skills/02-project-init/actions/04-review-memory.md) | - |
| `actions` | [05-init-rules-skeleton.md](skills/02-project-init/actions/05-init-rules-skeleton.md) | - |
| `actions` | [06-sync-memory.md](skills/02-project-init/actions/06-sync-memory.md) | - |
| `assets` | [AGENTS.md](skills/02-project-init/assets/AGENTS.md) | `AI agent configuration and guidelines` |
| `assets` | [golden-principles.md](skills/02-project-init/assets/golden-principles.md) | - |
| `assets` | [GUIDELINES.md](skills/02-project-init/assets/GUIDELINES.md) | - |
| `assets` | [README.md](skills/02-project-init/assets/README.md) | - |
| `references` | [mapping-ai-context-file.md](skills/02-project-init/references/mapping-ai-context-file.md) | - |
| `-` | [SKILL.md](skills/02-project-init/SKILL.md) | `Initialize or refresh the project memory bank, scaffold the rules directory, and ensure AI context files contain the project memory block. Use when running `aidd init` for the first time, bootstrapping a new project, or re-running the init flow on an existing project. Do NOT use for updating individual memory files after they exist - use `aidd-context:05:learn` instead; do NOT use for editing a single rule - edit the file directly.` |

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
| `actions` | [01-mermaid.md](skills/04-mermaid/actions/01-mermaid.md) | `When need to generate Mermaid diagrams` |
| `references` | [mermaid-conventions.md](skills/04-mermaid/references/mermaid-conventions.md) | `Rules for generating valid, high-quality Mermaid diagrams. Apply when creating or reviewing any Mermaid diagram (flowchart, state, ER, sequence, gantt).` |
| `-` | [SKILL.md](skills/04-mermaid/SKILL.md) | `Generate high-quality Mermaid diagrams from markdown content using a structured plan-validate workflow.` |

#### `skills/05-learn`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `actions` | [01-learn.md](skills/05-learn/actions/01-learn.md) | `Update memory bank or rules with new information or requirements.` | - |
| `assets` | [adr-template.md](skills/05-learn/assets/adr-template.md) | `Architecture Decision Record template` | - |
| `assets` | [decision-template.md](skills/05-learn/assets/decision-template.md) | `Individual decision record template` | `<title>` |
| `-` | [SKILL.md](skills/05-learn/SKILL.md) | `Capture and store learnings from recently implemented features into memory bank, decisions, or coding rules.` | - |

#### `skills/06-discovery`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-find-skill.md](skills/06-discovery/actions/01-find-skill.md) | `Help the user discover installed skills and find the right one for their use case.` |
| `-` | [SKILL.md](skills/06-discovery/SKILL.md) | `Help users discover installed skills and find the right one for their use case.` |

