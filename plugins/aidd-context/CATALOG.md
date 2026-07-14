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
| `actions` | [01-scan.md](skills/00-onboard/actions/01-scan.md) | - |
| `actions` | [02-assess.md](skills/00-onboard/actions/02-assess.md) | - |
| `actions` | [03-present.md](skills/00-onboard/actions/03-present.md) | - |
| `actions` | [04-run.md](skills/00-onboard/actions/04-run.md) | - |
| `assets` | [banner.txt](skills/00-onboard/assets/banner.txt) | - |
| `assets` | [report.md](skills/00-onboard/assets/report.md) | - |
| `references` | [flow.md](skills/00-onboard/references/flow.md) | - |
| `-` | [SKILL.md](skills/00-onboard/SKILL.md) | `Guide a project's journey through AIDD, from first setup to shipping a feature. Use when the user says onboard me, where do I start, or what to do next. Not for listing every installed surface.` |

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
| `references` | [stack-heuristics.md](skills/01-bootstrap/references/stack-heuristics.md) | - |
| `-` | [SKILL.md](skills/01-bootstrap/SKILL.md) | `Design and validate a new SaaS's architecture into an INSTALL.md via Q&A and stack comparison. Use when the user starts a project, chooses a stack, or picks an architecture pattern. Not for editing an existing stack or scaffolding code.` |

#### `skills/02-project-memory`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-scan.md](skills/02-project-memory/actions/01-scan.md) | - |
| `actions` | [02-generate.md](skills/02-project-memory/actions/02-generate.md) | - |
| `actions` | [03-sync.md](skills/02-project-memory/actions/03-sync.md) | - |
| `assets` | [AGENTS.md](skills/02-project-memory/assets/AGENTS.md) | - |
| `assets` | [CONTRIBUTING.md](skills/02-project-memory/assets/CONTRIBUTING.md) | - |
| `assets` | [GUIDELINES.md](skills/02-project-memory/assets/GUIDELINES.md) | - |
| `assets` | [README.md](skills/02-project-memory/assets/README.md) | - |
| `references` | [capability-signals.md](skills/02-project-memory/references/capability-signals.md) | - |
| `references` | [memory-block.md](skills/02-project-memory/references/memory-block.md) | - |
| `references` | [memory-destinations.md](skills/02-project-memory/references/memory-destinations.md) | - |
| `references` | [memory-rules.md](skills/02-project-memory/references/memory-rules.md) | - |
| `references` | [review-protocol.md](skills/02-project-memory/references/review-protocol.md) | - |
| `references` | [tools.md](skills/02-project-memory/references/tools.md) | - |
| `-` | [SKILL.md](skills/02-project-memory/SKILL.md) | `Give the AI a memory of the project, wired into the tools you use. Use when the user wants to set up or refresh the project memory. Not for editing a single memory file that already exists.` |

#### `skills/03-context-generate`

| File | Description |
|------|---|
| [SKILL.md](skills/03-context-generate/SKILL.md) | `Route a request to generate a context artifact (skill, rule, agent, command, or hook) to its generator when the kind is unnamed. A named kind triggers its generator directly. Not for listing existing artifacts.` |

#### `skills/04-skill-generate`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-capture-intent.md](skills/04-skill-generate/actions/01-capture-intent.md) | - |
| `actions` | [02-decompose-actions.md](skills/04-skill-generate/actions/02-decompose-actions.md) | - |
| `actions` | [03-draft-skill.md](skills/04-skill-generate/actions/03-draft-skill.md) | - |
| `actions` | [04-write-actions.md](skills/04-skill-generate/actions/04-write-actions.md) | - |
| `actions` | [05-validate.md](skills/04-skill-generate/actions/05-validate.md) | - |
| `assets` | [action-template.md](skills/04-skill-generate/assets/action-template.md) | - |
| `assets` | [skill-template.md](skills/04-skill-generate/assets/skill-template.md) | `<Verb-led, what the skill produces, one clause>. Use when the user wants to <distinct intents>. <Optional: "Not for <X>" in plain words when a sibling could mis-trigger.> (Two lines max, ~240 chars, straight to the point. Third person, no XML. Never name another skill, never write a /command token. All "when" lives here, not in the body.)` |
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
| `references` | [rule-authoring.md](skills/05-rule-generate/references/rule-authoring.md) | - |
| `references` | [tool-paths.md](skills/05-rule-generate/references/tool-paths.md) | - |
| `-` | [SKILL.md](skills/05-rule-generate/SKILL.md) | `Generate a coding rule that governs editor and agent behavior across the host AI tools. Use when the user wants to write, add, or refactor a rule, convention, or coding standard. Not for other artifacts like skills, agents, or hooks.` |

#### `skills/06-agent-generate`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-capture-agent.md](skills/06-agent-generate/actions/01-capture-agent.md) | - |
| `actions` | [02-write-agent.md](skills/06-agent-generate/actions/02-write-agent.md) | - |
| `actions` | [03-validate.md](skills/06-agent-generate/actions/03-validate.md) | - |
| `assets` | [agent-template.md](skills/06-agent-generate/assets/agent-template.md) | `<what it does + when to use>  # required, third person` |
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
| `-` | [SKILL.md](skills/08-hook-generate/SKILL.md) | `Generate a hook, a handler that runs at a lifecycle event, across the host AI tools. Use when the user wants to create, scaffold, or refactor a hook, or automate an action at a lifecycle point. Not for other artifacts like skills or rules.` |

#### `skills/09-mermaid`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-mermaid.md](skills/09-mermaid/actions/01-mermaid.md) | - |
| `references` | [mermaid-conventions.md](skills/09-mermaid/references/mermaid-conventions.md) | - |
| `-` | [SKILL.md](skills/09-mermaid/SKILL.md) | `Generate a valid Mermaid diagram from a written source through a plan, generate, review loop. Use when the user wants to turn an architecture, lifecycle, or flow into a Mermaid diagram. Not for other diagram formats or image rendering.` |

#### `skills/10-learn`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-gather.md](skills/10-learn/actions/01-gather.md) | - |
| `actions` | [02-assess.md](skills/10-learn/actions/02-assess.md) | - |
| `actions` | [03-write.md](skills/10-learn/actions/03-write.md) | - |
| `actions` | [04-sync.md](skills/10-learn/actions/04-sync.md) | - |
| `assets` | [decision-template.md](skills/10-learn/assets/decision-template.md) | - |
| `-` | [SKILL.md](skills/10-learn/SKILL.md) | `Capture durable project learnings from the conversation or git history into memory, a record, a rule, or a skill. Use when the user asks to capture, record, or remember a decision or lesson. Not for AI preferences or already-captured items.` |

#### `skills/11-explore`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-survey.md](skills/11-explore/actions/01-survey.md) | - |
| `actions` | [02-drill.md](skills/11-explore/actions/02-drill.md) | - |
| `references` | [ai-mapping.md](skills/11-explore/references/ai-mapping.md) | - |
| `-` | [SKILL.md](skills/11-explore/SKILL.md) | `Explore the current project across its tooling, context, and codebase. Use to survey what is installed, see what is available, or find which skill, agent, or rule fits a goal. Not for choosing the next step or running an item; it only points.` |

#### `skills/12-cook`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-list.md](skills/12-cook/actions/01-list.md) | - |
| `actions` | [02-upsert.md](skills/12-cook/actions/02-upsert.md) | - |
| `assets` | [recipe-template.md](skills/12-cook/assets/recipe-template.md) | - |
| `-` | [SKILL.md](skills/12-cook/SKILL.md) | `Manage the project's recipes and how-to sheets. List them as a table, or create and update one from the canonical template. Use when the user wants to list, create, update, or cook a recipe.` |

