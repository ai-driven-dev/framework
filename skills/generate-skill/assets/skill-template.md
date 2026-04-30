---
name: <skill-name>
description: <What the skill does in one clause, third person>. Use when <explicit trigger phrases users will actually type>. Do NOT use for <excluded cases> — use `<competing-skill>` instead.
---

# <Skill Name>

<One-paragraph summary of the skill's purpose. What does running it produce? When is it most useful? Keep it to 2–3 sentences.>

## Available actions

| #   | Action   | Role                 | Input            |
| --- | -------- | -------------------- | ---------------- |
| 01  | `<slug>` | <one-line role>      | <required input> |
| 02  | `<slug>` | <one-line role>      | <required input> |

## Default flow

<Sequential skill: `01 → 02 → 03`. No skipping allowed.>
<OR — Non-sequential skill: the router dispatches based on user intent. Trigger-to-action mapping:>
<- "<trigger phrase>" → `<slug>`>
<- "<trigger phrase>" → `<slug>`>

## Transversal rules

<Rules that apply to every action in this skill. Be specific to your domain. Examples of the kind of rule that belongs here — replace with yours:>
- <Style guide: follow `<path-to-your-style-guide>.md`.>
- <MCP: use the qualified name `mcp__<server>__<tool>` for every MCP call.>
- <Required env vars: listed in `.env.local`.>

## References (documents to read)

- `references/<file>.md` — <what this reference covers>

## Assets (templates to copy or data to inject)

- `assets/<file>.json` — <what this asset provides>

## External data (cross-skill pointers per R7)

<Optional. Include only if the skill depends on data/docs that live outside this skill (e.g. in a shared folder at repo root). Always point, never copy.>

- `<relative/path/to/shared/file>` — <what this shared resource provides and why this skill points to it>
