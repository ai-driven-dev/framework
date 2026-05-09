# aidd-pm catalog

Auto-generated index of skills, agents, references and assets shipped by the `aidd-pm` plugin.

> This file is automatically updated by the `scripts/summarize-markdown.mjs` script.

## Table of Contents

- [`.claude-plugin`](#claude-plugin)
- [`skills`](#skills)
  - [`skills/01-ticket-info`](#skills01-ticket-info)
  - [`skills/02-user-stories-create`](#skills02-user-stories-create)
  - [`skills/03-prd`](#skills03-prd)
  - [`skills/05-spec`](#skills05-spec)

---

### `.claude-plugin`

| File |
|------|
| [plugin.json](.claude-plugin/plugin.json) |

### `skills`

#### `skills/01-ticket-info`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-ticket-info.md](skills/01-ticket-info/actions/01-ticket-info.md) | - |
| `evals` | [scenarios.json](skills/01-ticket-info/evals/scenarios.json) | - |
| `-` | [SKILL.md](skills/01-ticket-info/SKILL.md) | `Retrieve and display ticket information from the configured ticketing tool. Use when the user says "ticket info", "show ticket", "get ticket", "ticket details", "what's <id>", or invokes `/ticket-info`. Do NOT use for creating issues, commenting on tickets, changing status, or reassigning.` |

#### `skills/02-user-stories-create`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `actions` | [01-create-user-stories.md](skills/02-user-stories-create/actions/01-create-user-stories.md) | - | - |
| `assets` | [user-story-template.md](skills/02-user-stories-create/assets/user-story-template.md) | `Template for defining user stories with estimation and acceptance criteria` | - |
| `evals` | [scenarios.json](skills/02-user-stories-create/evals/scenarios.json) | - | - |
| `-` | [SKILL.md](skills/02-user-stories-create/SKILL.md) | `Generate INVEST-compliant user stories from a feature description. Use when the user says "user stories", "create user stories", "write user stories for X", "INVEST stories", "draft stories", or invokes `/create-user-stories`. Do NOT use for writing code, drafting a full PRD, refining a single existing story, or copying ready text into a tracker.` | - |

#### `skills/03-prd`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `actions` | [01-prd.md](skills/03-prd/actions/01-prd.md) | - | - |
| `assets` | [prd-template.md](skills/03-prd/assets/prd-template.md) | `Product Requirements Document template (15 sections)` | - |
| `assets` | [task-template.md](skills/03-prd/assets/task-template.md) | `Task tracking system to ensure all tasks are categorized and addressed` | - |
| `evals` | [scenarios.json](skills/03-prd/evals/scenarios.json) | - | - |
| `-` | [SKILL.md](skills/03-prd/SKILL.md) | `Generate a structured Product Requirements Document from a feature description or user stories, validated with the user before save. Use when the user says "prd", "draft prd", "write prd", "product requirements for X", "generate a prd", or invokes `/prd`. Do NOT use for writing user stories, drafting a technical implementation plan, or writing source code.` | - |

#### `skills/05-spec`

| Group | File | Description |
|-------|------|---|
| `assets` | [spec-template.md](skills/05-spec/assets/spec-template.md) | - |
| `-` | [SKILL.md](skills/05-spec/SKILL.md) | `Generates and refines a project spec from a free-form human request. The spec is the immutable target a planner consumes. Use when starting a new run, when an existing spec needs refinement after review, or when a human wants to draft a spec collaboratively.` |

