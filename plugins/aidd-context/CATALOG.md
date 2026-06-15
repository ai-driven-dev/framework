# aidd-context catalog

Auto-generated index of skills, agents, references and assets shipped by the `aidd-context` plugin.

> This file is automatically updated by the `scripts/summarize-markdown.js` script.

## Table of Contents

- [`.claude-plugin`](#claude-plugin)
- [`hooks`](#hooks)
- [`skills`](#skills)
  - [`skills/00-onboard`](#skills00-onboard)
  - [`skills/01-bootstrap`](#skills01-bootstrap)
  - [`skills/02-project-init`](#skills02-project-init)
  - [`skills/03-context-generate`](#skills03-context-generate)
  - [`skills/04-skill-generate`](#skills04-skill-generate)
  - [`skills/05-rule-generate`](#skills05-rule-generate)
  - [`skills/06-agent-generate`](#skills06-agent-generate)
  - [`skills/07-command-generate`](#skills07-command-generate)
  - [`skills/08-hook-generate`](#skills08-hook-generate)
  - [`skills/09-mermaid`](#skills09-mermaid)
  - [`skills/10-learn`](#skills10-learn)
  - [`skills/11-discovery`](#skills11-discovery)
  - [`skills/12-design-system`](#skills12-design-system)

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
| `-` | [README.md](skills/00-onboard/README.md) | - |
| `-` | [SKILL.md](skills/00-onboard/SKILL.md) | `Detect the current project's state and open a hub of project actions - understand the project, set up or refresh the memory bank, or continue the AIDD development journey. Silently inspects the project, the AIDD setup, and which AIDD plugins are installed, then adapts the menu to that context. Use when the user says "where do I start", "onboard me", "onboard me to this project", "what should I run next", "what should I work on next", "what's the state of this project", "guide me through aidd", "guide me through aidd-context", or invokes `aidd-context:00-onboard`. Do NOT use to enumerate every installed surface from raw user intent (the discovery skill in this plugin handles that).` |

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
| `-` | [README.md](skills/02-project-init/README.md) | - |
| `references` | [mapping-ai-context-file.md](skills/02-project-init/references/mapping-ai-context-file.md) | - |
| `-` | [SKILL.md](skills/02-project-init/SKILL.md) | `Initialize or refresh the project memory bank and ensure AI context files contain the project memory block. Use when running `aidd init` for the first time, bootstrapping a new project, or re-running the init flow on an existing project. Do NOT use for updating individual memory files after they exist - use `aidd-context:10-learn` instead; do NOT use for editing a single rule - edit the file directly.` |

#### `skills/03-context-generate`

| File | Description |
|------|---|
| [README.md](skills/03-context-generate/README.md) | - |
| [SKILL.md](skills/03-context-generate/SKILL.md) | `Route a request to generate a context artifact (skill, rule, agent, command, or hook) to its dedicated generator when the user has not named which kind. For a named kind, that generator triggers directly. Not for listing existing artifacts (use discovery).` |

#### `skills/04-skill-generate`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-capture-intent.md](skills/04-skill-generate/actions/01-capture-intent.md) | - |
| `actions` | [02-decompose-actions.md](skills/04-skill-generate/actions/02-decompose-actions.md) | - |
| `actions` | [03-draft-skill.md](skills/04-skill-generate/actions/03-draft-skill.md) | - |
| `actions` | [04-write-actions.md](skills/04-skill-generate/actions/04-write-actions.md) | - |
| `actions` | [05-validate.md](skills/04-skill-generate/actions/05-validate.md) | - |
| `assets` | [action-template.md](skills/04-skill-generate/assets/action-template.md) | - |
| `assets` | [skill-template.md](skills/04-skill-generate/assets/skill-template.md) | `<What the skill does, third person, one clause>. Use when <explicit, slightly pushy trigger phrases users actually type; the model under-triggers, so over-list>. <Optional: "Not for <X>, use <Y>" only when a sibling skill could mis-trigger.> (<= 1024 chars, third person, no XML tags; all "when" lives here, not in the body.)` |
| `-` | [README.md](skills/04-skill-generate/README.md) | - |
| `references` | [skill-authoring.md](skills/04-skill-generate/references/skill-authoring.md) | - |
| `references` | [tool-paths.md](skills/04-skill-generate/references/tool-paths.md) | - |
| `-` | [SKILL.md](skills/04-skill-generate/SKILL.md) | `Generate a router-based skill across the host AI tools a project uses. Use when the user wants to create, scaffold, or refactor a skill, or turn a workflow into one. Not for other artifacts like rules, agents, commands, hooks.` |

#### `skills/05-rule-generate`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-capture-rule.md](skills/05-rule-generate/actions/01-capture-rule.md) | - |
| `actions` | [02-write-rule.md](skills/05-rule-generate/actions/02-write-rule.md) | - |
| `actions` | [03-validate.md](skills/05-rule-generate/actions/03-validate.md) | - |
| `assets` | [rule-template.md](skills/05-rule-generate/assets/rule-template.md) | - |
| `-` | [README.md](skills/05-rule-generate/README.md) | - |
| `references` | [rule-authoring.md](skills/05-rule-generate/references/rule-authoring.md) | - |
| `references` | [tool-paths.md](skills/05-rule-generate/references/tool-paths.md) | - |
| `-` | [SKILL.md](skills/05-rule-generate/SKILL.md) | `Generate a coding rule that governs editor and agent behavior, across the host AI tools a project uses. Use when the user wants to write, add, or refactor a rule, a convention, or a coding standard, or to scan a codebase and propose rules. Not for other artifacts like skills, agents, commands, hooks.` |

#### `skills/06-agent-generate`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-capture-agent.md](skills/06-agent-generate/actions/01-capture-agent.md) | - |
| `actions` | [02-write-agent.md](skills/06-agent-generate/actions/02-write-agent.md) | - |
| `actions` | [03-validate.md](skills/06-agent-generate/actions/03-validate.md) | - |
| `assets` | [agent-template.md](skills/06-agent-generate/assets/agent-template.md) | `<what it does + when to use>  # required, third person` |
| `-` | [README.md](skills/06-agent-generate/README.md) | - |
| `references` | [agent-authoring.md](skills/06-agent-generate/references/agent-authoring.md) | - |
| `references` | [tool-paths.md](skills/06-agent-generate/references/tool-paths.md) | - |
| `-` | [SKILL.md](skills/06-agent-generate/SKILL.md) | `Generate an agent across the host AI tools a project uses. Use when the user wants to create, scaffold, or refactor an agent, subagent or specialized role. Not for other artifacts like skills, rules, commands, hooks.` |

#### `skills/07-command-generate`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-capture-command.md](skills/07-command-generate/actions/01-capture-command.md) | - |
| `actions` | [02-write-command.md](skills/07-command-generate/actions/02-write-command.md) | - |
| `actions` | [03-validate.md](skills/07-command-generate/actions/03-validate.md) | - |
| `assets` | [command-template.md](skills/07-command-generate/assets/command-template.md) | - |
| `-` | [README.md](skills/07-command-generate/README.md) | - |
| `references` | [command-authoring.md](skills/07-command-generate/references/command-authoring.md) | - |
| `references` | [tool-paths.md](skills/07-command-generate/references/tool-paths.md) | - |
| `-` | [SKILL.md](skills/07-command-generate/SKILL.md) | `Generate a flat slash command across the host AI tools a project uses. Use when the user wants to create, scaffold, or refactor a one-shot slash command. Not for multi-step skills or other artifacts like rules, agents, hooks.` |

#### `skills/08-hook-generate`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-capture-hook.md](skills/08-hook-generate/actions/01-capture-hook.md) | - |
| `actions` | [02-write-hook.md](skills/08-hook-generate/actions/02-write-hook.md) | - |
| `actions` | [03-validate.md](skills/08-hook-generate/actions/03-validate.md) | - |
| `assets` | [hook-script-template.sh](skills/08-hook-generate/assets/hook-script-template.sh) | - |
| `assets` | [hook-template.json](skills/08-hook-generate/assets/hook-template.json) | - |
| `references` | [hook-authoring.md](skills/08-hook-generate/references/hook-authoring.md) | - |
| `references` | [tool-paths.md](skills/08-hook-generate/references/tool-paths.md) | - |
| `-` | [SKILL.md](skills/08-hook-generate/SKILL.md) | `Generate a hook (a handler that runs automatically at a lifecycle event) across the host AI tools a project uses. Use when the user wants to create, scaffold, or refactor a hook, or automate an action at a lifecycle point. Not for other artifacts like skills, rules, agents, commands.` |

#### `skills/09-mermaid`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-mermaid.md](skills/09-mermaid/actions/01-mermaid.md) | - |
| `-` | [README.md](skills/09-mermaid/README.md) | - |
| `references` | [mermaid-conventions.md](skills/09-mermaid/references/mermaid-conventions.md) | - |
| `-` | [SKILL.md](skills/09-mermaid/SKILL.md) | `Generate high-quality Mermaid diagrams from markdown content using a structured plan-validate workflow.` |

#### `skills/10-learn`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `actions` | [01-scope.md](skills/10-learn/actions/01-scope.md) | - | - |
| `actions` | [02-write.md](skills/10-learn/actions/02-write.md) | - | - |
| `actions` | [03-sync.md](skills/10-learn/actions/03-sync.md) | - | - |
| `assets` | [adr-template.md](skills/10-learn/assets/adr-template.md) | `Architecture Decision Record template` | - |
| `assets` | [decision-template.md](skills/10-learn/assets/decision-template.md) | `Individual decision record template` | `<title>` |
| `-` | [README.md](skills/10-learn/README.md) | - | - |
| `-` | [SKILL.md](skills/10-learn/SKILL.md) | `Capture and store project-level learnings, conventions, and decisions surfaced during work into memory, decisions, or rules. Use proactively when the user states a durable project rule or convention ("for next", "always do X", "from now on", "going forward", "rule:", "convention:"), records a technical decision and its rationale, deprecates something, or notes an insight that should outlive the current task. Do NOT use for personal or AI-preference reminders (those belong to user memory), routine code edits, minor fixes, or anything already captured.` | - |

#### `skills/11-discovery`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-find-skill.md](skills/11-discovery/actions/01-find-skill.md) | - |
| `actions` | [02-find-agent.md](skills/11-discovery/actions/02-find-agent.md) | - |
| `actions` | [03-find-command.md](skills/11-discovery/actions/03-find-command.md) | - |
| `actions` | [04-find-plugin.md](skills/11-discovery/actions/04-find-plugin.md) | - |
| `actions` | [05-find-mcp.md](skills/11-discovery/actions/05-find-mcp.md) | - |
| `actions` | [06-find-rule.md](skills/11-discovery/actions/06-find-rule.md) | - |
| `actions` | [07-find-hook.md](skills/11-discovery/actions/07-find-hook.md) | - |
| `actions` | [08-find-memory.md](skills/11-discovery/actions/08-find-memory.md) | - |
| `-` | [README.md](skills/11-discovery/README.md) | - |
| `references` | [ai-mapping.md](skills/11-discovery/references/ai-mapping.md) | - |
| `-` | [SKILL.md](skills/11-discovery/SKILL.md) | `Enumerate installed surfaces of the AI tool (skills, agents, commands, plugins, MCP servers, rules, hooks, memory files) and recommend the best match for the user's stated intent. Use proactively whenever the user asks the model to list, show, enumerate, find, or pick among any of these surfaces - including imperative phrasings ("list hooks", "show me the rules", "enumerate skills", "find a memory file", "which agent reviews code"), question phrasings ("what's available?", "what hooks do we have?", "which rule applies here?", "what memory files do we have?"), and indirect phrasings ("what can I use for X?", "do we have something that does Y?"). Always pick this skill over scanning the filesystem with grep, find, ls, or reading action files directly when the user is enumerating a surface. Do NOT use for picking a specific item inside one plugin (the plugin's own onboard handles that), creating a new surface, or executing a recommended item (this skill only points; the user invokes).` |

#### `skills/12-design-system`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-create-design-system.md](skills/12-design-system/actions/01-create-design-system.md) | - |
| `actions` | [02-redesign-page.md](skills/12-design-system/actions/02-redesign-page.md) | - |
| `-` | [README.md](skills/12-design-system/README.md) | - |
| `-` | [SKILL.md](skills/12-design-system/SKILL.md) | `Initialize a project's design system through a guided, ordered playbook that routes each step to the right Impeccable command - register and color strategy, palette with accessibility validation, typography, spacing, elevation, motion, components, and the canonical DESIGN.md.` |

