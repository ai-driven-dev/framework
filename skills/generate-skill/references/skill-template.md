# Skill template

Use this template for every generated SKILL.md orchestrator.

````markdown
---
name: <skill-name>
description: <When to trigger — be specific, include keywords and contexts. One sentence on what the skill does.>
---

# <Skill display name>

<One paragraph: what this skill accomplishes end-to-end.>

## Context

- **Goal**: <Measurable end state. What is true when the skill has succeeded?>
- **Tools required**: <Every tool, MCP server, API, or integration needed.>
- **Trigger**: <Manual, scheduled, or event-driven.>

## Environment

<List every secret, API key, token, or credential the skill needs at runtime. If the skill needs no secrets, write "None — no secrets required." and omit the files below.>

### `.env` — Secrets (gitignored, never committed)

```env
# <SERVICE_NAME>
<VAR_NAME>=<actual secret value>
```

### `.env.local` — Setup instructions (committed, no secrets)

```env
# <SERVICE_NAME>
# <VAR_NAME>: <How to obtain this value. Be specific: URL to the dashboard, exact menu path, command to run, or person to ask.>
```

**Rules:**
- `.env` holds actual secret values. It MUST be in `.gitignore`.
- `.env.local` holds human-readable instructions to generate/obtain each secret. It IS committed.
- Every variable in `.env` MUST have a corresponding instruction in `.env.local`.
- Group variables by service/provider with a comment header.

## Transversal rules

<Rules inherited by ALL sub-actions. Each is a conditional behavior.>

1. **<Rule name>**: IF <condition> THEN <action>.
2. **<Rule name>**: IF <condition> THEN <action>.

## Execution flow

<Ordered list of sub-action files. Indentation shows parallelization.>

1. `sub-actions/01-<slug>.md`
2. `sub-actions/02-<slug>.md` — depends on step 1 output
3. In parallel:
   - `sub-actions/03-<slug-a>.md`
   - `sub-actions/03-<slug-b>.md`
4. `sub-actions/04-<slug>.md` — depends on all step 3 outputs

## References

<Documentation files used by this skill. Each reference is a documentation file that explains a domain, a tool, or a convention.>

- `references/<topic>.md` — <what it documents and why it's needed>

````

## Guidelines

- Keep SKILL.md under 100 lines. All detail lives in sub-action and reference files.
- Transversal rules use strict `IF ... THEN ...` format. No vague guidance.
- A sub-action can override a transversal rule locally — local scope wins.
- Execution flow is the single source of truth for ordering and parallelization.
- **Single source of truth**: every fact lives in exactly one file. Before adding info, search the skill for existing occurrences. Canonical locations: orchestration → `SKILL.md`, step logic → `sub-actions/`, documentation → `references/`, secrets → `.env` / `.env.local`.
