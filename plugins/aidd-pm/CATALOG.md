# aidd-pm catalog

Auto-generated index of skills, agents, references and assets shipped by the `aidd-pm` plugin.

> This file is automatically updated by the `scripts/summarize-markdown.js` script.

## Table of Contents

- [`.claude-plugin`](#claude-plugin)
- [`skills`](#skills)
  - [`skills/01-ticket-info`](#skills01-ticket-info)
  - [`skills/02-user-stories`](#skills02-user-stories)
  - [`skills/03-prd`](#skills03-prd)
  - [`skills/04-spec`](#skills04-spec)

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
| `-` | [README.md](skills/01-ticket-info/README.md) | - |
| `-` | [SKILL.md](skills/01-ticket-info/SKILL.md) | `Retrieve and display ticket information from the configured ticketing tool. Use when the user says "ticket info", "show ticket", "get ticket", "ticket details", "what's <id>", or invokes `/ticket-info`. Do NOT use for creating issues, commenting on tickets, changing status, or reassigning.` |

#### `skills/02-user-stories`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-clarify-scope.md](skills/02-user-stories/actions/01-clarify-scope.md) | - |
| `actions` | [02-split-epic.md](skills/02-user-stories/actions/02-split-epic.md) | - |
| `actions` | [03-draft-stories.md](skills/02-user-stories/actions/03-draft-stories.md) | - |
| `actions` | [04-estimate-impact.md](skills/02-user-stories/actions/04-estimate-impact.md) | - |
| `actions` | [05-prioritize.md](skills/02-user-stories/actions/05-prioritize.md) | - |
| `actions` | [06-sync-tracker.md](skills/02-user-stories/actions/06-sync-tracker.md) | - |
| `assets` | [user-story-template.md](skills/02-user-stories/assets/user-story-template.md) | - |
| `-` | [README.md](skills/02-user-stories/README.md) | - |
| `references` | [rating.md](skills/02-user-stories/references/rating.md) | - |
| `-` | [SKILL.md](skills/02-user-stories/SKILL.md) | `Turn a feature or epic into a prioritized, estimated, INVEST-compliant user-story backlog saved to the project's tracker. Use for "user stories", "split this epic", "break down this feature", "estimate/prioritize the backlog", or `/user-stories`. Not for source code or a full PRD (use `03-prd`).` |

#### `skills/03-prd`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-prd.md](skills/03-prd/actions/01-prd.md) | - |
| `assets` | [prd-template.md](skills/03-prd/assets/prd-template.md) | `Product Requirements Document template (15 sections)` |
| `assets` | [task-template.md](skills/03-prd/assets/task-template.md) | `Task tracking system to ensure all tasks are categorized and addressed` |
| `-` | [README.md](skills/03-prd/README.md) | - |
| `-` | [SKILL.md](skills/03-prd/SKILL.md) | `Generate a structured Product Requirements Document from a feature description or user stories, validated with the user before save. Use when the user says "prd", "draft prd", "write prd", "product requirements for X", "generate a prd", or invokes `/prd`. Do NOT use for writing user stories, drafting a technical implementation plan, or writing source code.` |

#### `skills/04-spec`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-build.md](skills/04-spec/actions/01-build.md) | - |
| `actions` | [02-refine.md](skills/04-spec/actions/02-refine.md) | - |
| `assets` | [spec-template.md](skills/04-spec/assets/spec-template.md) | - |
| `-` | [README.md](skills/04-spec/README.md) | - |
| `-` | [SKILL.md](skills/04-spec/SKILL.md) | `Generate or refine a spec, the immutable contract behind a feature, from a free-form request, an existing PRD, or review findings. Use to draft a spec ("spec for X", "/spec") or to refine one from findings. Do NOT use to write code, a full PRD, or to change a locked spec.` |

