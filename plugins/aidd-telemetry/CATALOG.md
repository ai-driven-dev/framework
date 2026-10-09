# aidd-telemetry catalog

Auto-generated index of skills, agents, references and assets shipped by the `aidd-telemetry` plugin.

> This file is automatically updated by the `scripts/summarize-markdown.js` script.

## Table of Contents

- [`.claude-plugin`](#claude-plugin)
- [`hooks`](#hooks)
- [`skills`](#skills)
  - [`skills/00-init`](#skills00-init)
  - [`skills/01-usage`](#skills01-usage)

---

### `.claude-plugin`

| File |
|------|
| [plugin.json](.claude-plugin/plugin.json) |

### `hooks`

| File |
|------|
| [hooks.json](hooks/hooks.json) |

### `skills`

#### `skills/00-init`

| Group | File | Description |
|-------|------|---|
| `actions` | [forget.md](skills/00-init/actions/forget.md) | - |
| `actions` | [identity.md](skills/00-init/actions/identity.md) | - |
| `actions` | [start.md](skills/00-init/actions/start.md) | - |
| `actions` | [stop.md](skills/00-init/actions/stop.md) | - |
| `-` | [SKILL.md](skills/00-init/SKILL.md) | `Turn AIDD measurement on for a project after explicit consent, stop it, choose to be named on your own measurement, or delete what was measured. Use when the user wants to start or stop measuring what their work consumes, add or remove their name, or forget measured data. Not for answering what a period consumed.` |

#### `skills/01-usage`

| Group | File | Description |
|-------|------|---|
| `actions` | [answer.md](skills/01-usage/actions/answer.md) | - |
| `actions` | [frame.md](skills/01-usage/actions/frame.md) | - |
| `references` | [envelope.md](skills/01-usage/references/envelope.md) | - |
| `-` | [SKILL.md](skills/01-usage/SKILL.md) | `Answer what a period or one piece of work consumed in tokens, per day, model, task, ticket, session, repository or person, from the local measurement. Use when the user asks how many tokens were spent, where the effort went, or what a task or ticket consumed. Not for turning measurement on or off.` |

