# aidd-context catalog

Auto-generated index of skills, agents, references and assets shipped by the `aidd-context` plugin.

> This file is automatically updated by the `scripts/summarize-markdown.js` script.

## Table of Contents

- [`.claude-plugin`](#claude-plugin)
- [`hooks`](#hooks)
- [`skills`](#skills)
  - [`skills/00-onboard`](#skills00-onboard)
  - [`skills/01-bootstrap`](#skills01-bootstrap)
  - [`skills/02-project-memory`](#skills02-project-memory)
  - [`skills/03-context-generate`](#skills03-context-generate)
  - [`skills/04-skill-generate`](#skills04-skill-generate)
  - [`skills/05-rule-generate`](#skills05-rule-generate)
  - [`skills/06-agent-generate`](#skills06-agent-generate)
  - [`skills/07-command-generate`](#skills07-command-generate)
  - [`skills/08-hook-generate`](#skills08-hook-generate)
  - [`skills/09-mermaid`](#skills09-mermaid)
  - [`skills/10-learn`](#skills10-learn)
  - [`skills/11-explore`](#skills11-explore)
  - [`skills/12-cook`](#skills12-cook)

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
| `actions` | [01-read-project.md](skills/00-onboard/actions/01-read-project.md) | - |
| `actions` | [02-orient.md](skills/00-onboard/actions/02-orient.md) | - |
| `actions` | [03-act.md](skills/00-onboard/actions/03-act.md) | - |
| `-` | [README.md](skills/00-onboard/README.md) | - |
| `references` | [journey.md](skills/00-onboard/references/journey.md) | - |
| `-` | [SKILL.md](skills/00-onboard/SKILL.md) | `Guide the user through the AIDD framework on the current project. Explain the flow in plain language and suggest the next logical step, adapted to what is already set up and which AIDD plugins are installed. Use when the user asks where to start, what to do next, how AIDD works, or to be onboarded. Not for listing every installed surface (the explore skill does that) or running a skill the user already knows they need (invoke it directly).` |

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

#### `skills/02-project-memory`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-init-context-file.md](skills/02-project-memory/actions/01-init-context-file.md) | - |
| `actions` | [02-scaffold-docs.md](skills/02-project-memory/actions/02-scaffold-docs.md) | - |
| `actions` | [03-generate-memory.md](skills/02-project-memory/actions/03-generate-memory.md) | - |
| `actions` | [04-review-memory.md](skills/02-project-memory/actions/04-review-memory.md) | - |
| `actions` | [05-sync-memory.md](skills/02-project-memory/actions/05-sync-memory.md) | - |
| `assets` | [AGENTS.md](skills/02-project-memory/assets/AGENTS.md) | - |
| `assets` | [CONTRIBUTING.md](skills/02-project-memory/assets/CONTRIBUTING.md) | - |
| `assets` | [GUIDELINES.md](skills/02-project-memory/assets/GUIDELINES.md) | - |
| `assets` | [README.md](skills/02-project-memory/assets/README.md) | - |
| `assets` | [review-checklist.md](skills/02-project-memory/assets/review-checklist.md) | - |
| `-` | [README.md](skills/02-project-memory/README.md) | - |
| `references` | [capability-signals.md](skills/02-project-memory/references/capability-signals.md) | - |
| `references` | [mapping-ai-context-file.md](skills/02-project-memory/references/mapping-ai-context-file.md) | - |
| `-` | [SKILL.md](skills/02-project-memory/SKILL.md) | `Initialize or refresh the project memory bank. Not for updating one memory file after it exists (use the learn skill) or editing a single rule (edit it directly).` |

#### `skills/03-context-generate`

| File | Description |
|------|---|
| [README.md](skills/03-context-generate/README.md) | - |
| [SKILL.md](skills/03-context-generate/SKILL.md) | `Route a request to generate a context artifact (skill, rule, agent, command, or hook) to its dedicated generator when the user has not named which kind. For a named kind, that generator triggers directly. Not for listing existing artifacts (use explore).` |

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
| `-` | [SKILL.md](skills/09-mermaid/SKILL.md) | `Generate a valid, high-quality Mermaid diagram from a written source through a plan, confirm, generate, review loop. Use when the user wants to turn an architecture, lifecycle, or flow description into a Mermaid diagram, or when another skill needs one. Not for other diagram formats like PlantUML or Graphviz, or for rendering a diagram to an image.` |

#### `skills/10-learn`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-gather.md](skills/10-learn/actions/01-gather.md) | - |
| `actions` | [02-assess.md](skills/10-learn/actions/02-assess.md) | - |
| `actions` | [03-write.md](skills/10-learn/actions/03-write.md) | - |
| `actions` | [04-sync.md](skills/10-learn/actions/04-sync.md) | - |
| `assets` | [decision-template.md](skills/10-learn/assets/decision-template.md) | - |
| `-` | [README.md](skills/10-learn/README.md) | - |
| `-` | [SKILL.md](skills/10-learn/SKILL.md) | `Capture durable project learnings from the conversation or the project's git history and route them to memory, a decision record, a rule, or a new skill. Use when the user asks to capture, record, or remember a decision, a convention, or a lesson, or to distill what recent work taught. Scores each candidate and confirms before writing. Not for personal or AI preferences, routine edits, or anything already captured.` |

#### `skills/11-explore`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-survey.md](skills/11-explore/actions/01-survey.md) | - |
| `actions` | [02-drill.md](skills/11-explore/actions/02-drill.md) | - |
| `-` | [README.md](skills/11-explore/README.md) | - |
| `references` | [ai-mapping.md](skills/11-explore/references/ai-mapping.md) | - |
| `-` | [SKILL.md](skills/11-explore/SKILL.md) | `Explore the current project across its tooling, context, and codebase. Use to survey what is installed and set up, see what is available, or find which installed skill, agent, or rule fits a goal. Not for the next step to take (onboard does that) or running an item (this skill only points).` |

#### `skills/12-cook`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-list.md](skills/12-cook/actions/01-list.md) | - |
| `actions` | [02-upsert.md](skills/12-cook/actions/02-upsert.md) | - |
| `assets` | [recipe-template.md](skills/12-cook/assets/recipe-template.md) | - |
| `-` | [README.md](skills/12-cook/README.md) | - |
| `-` | [SKILL.md](skills/12-cook/SKILL.md) | `Manage the project's recipes/ how-to sheets: list them as a table, or create and update one from the canonical template. Use for "list recipes", "new recipe", "update a recipe", "cook a recipe".` |

