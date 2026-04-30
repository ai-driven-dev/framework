# 04 — Draft SKILL.md router

Write the SKILL.md. Router only — no business logic.

## Inputs
- `skill_name`, `domain_type`, `expected_output` (from 01)
- `action_plan` (from 03)

## Outputs

`<skill>/SKILL.md` following `assets/skill-template.md`. Example frontmatter (for a hypothetical `slack` skill):

```yaml
---
name: slack
description: Posts messages, polls channel history, and manages channels via the Slack API. Use when the user mentions Slack, channel, or asks to send a chat message. Do NOT use for email (use `gmail`), Discord, or project-management notifications.
---
```

Example action table:

| #   | Action           | Role                        | Input             |
| --- | ---------------- | --------------------------- | ----------------- |
| 01  | `post-message`   | Post a message to a channel | channel, text     |
| 02  | `get-history`    | Fetch channel history       | channel, limit    |
| 03  | `create-channel` | Create a new channel        | name, is_private  |

## Process

1. Copy `assets/skill-template.md`.
2. Fill the YAML frontmatter per R5 (naming) and R6 (description content). Format constraints (char caps, third person, reserved words) are enforced by `references/naming-conventions.md` and checked by `scripts/validate-skill-md.js`.
3. Write the action table from the plan: `#`, slug, role, required input.
4. Default flow: sequential → chain `01 → 02 → ...`; non-sequential → trigger-to-action mapping.
5. Add transversal rules (shared style guide pointer, shared MCP, required env vars).
6. List `references/`, `assets/`, and any cross-skill/shared-folder pointers.

## Test

```bash
node scripts/validate-skill-md.js <target-skill-path>
```
