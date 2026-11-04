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
| `actions` | [01-probe.md](skills/00-init/actions/01-probe.md) | - |
| `actions` | [02-start.md](skills/00-init/actions/02-start.md) | - |
| `actions` | [03-identity.md](skills/00-init/actions/03-identity.md) | - |
| `actions` | [04-stop.md](skills/00-init/actions/04-stop.md) | - |
| `actions` | [05-forget.md](skills/00-init/actions/05-forget.md) | - |
| `actions` | [06-otel-init.md](skills/00-init/actions/06-otel-init.md) | - |
| `actions` | [07-otel-verify.md](skills/00-init/actions/07-otel-verify.md) | - |
| `-` | [SKILL.md](skills/00-init/SKILL.md) | `Configure and verify provider OpenTelemetry or manage local AIDD measurement. Use when the user wants to enable export, check receipt, start or stop usage measurement, change their identity, or delete measured data. Not for usage reports.` |

#### `skills/01-usage`

| Group | File | Description |
|-------|------|---|
| `actions` | [answer.md](skills/01-usage/actions/answer.md) | - |
| `actions` | [frame.md](skills/01-usage/actions/frame.md) | - |
| `references` | [envelope.md](skills/01-usage/references/envelope.md) | - |
| `-` | [SKILL.md](skills/01-usage/SKILL.md) | `Answer what a period or one piece of work consumed in tokens, per day, model, agent, tool, task, ticket, session, repository or person, from the local measurement. Use when the user asks how many tokens were spent, where the effort went, or what a task or ticket consumed. Not for turning measurement on or off.` |

