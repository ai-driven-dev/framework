---
name: aidd-pm:03:prd
description: Generate a structured Product Requirements Document from a feature description or user stories, validated with the user before save. Use when the user says "prd", "draft prd", "write prd", "product requirements for X", "generate a prd", or invokes `/prd`. Do NOT use for writing user stories, drafting a technical implementation plan, or writing source code.
---

# PRD

Drafts a structured Product Requirements Document covering scope, goals, and acceptance criteria.

## Available actions

| #   | Action  | Role                                                 | Input                                           |
| --- | ------- | ---------------------------------------------------- | ----------------------------------------------- |
| 01  | `prd`   | Parse input, draft per template, validate, save      | feature_description, user_stories (optional)    |

## Default flow

Single action skill. The router dispatches to `prd` whenever a PRD-generation phrase appears.

## Transversal rules

- Focus on what and why; never include technical implementation detail.
- Sections stay concise and actionable.
- Always wait for explicit user validation before saving.
- Save path: `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>-<feature_name>-prd.md`.
- Source of truth for structure: `${CLAUDE_PLUGIN_ROOT}/skills/03-prd/assets/prd-template.md`.

## References

- None.

## Assets

- `${CLAUDE_PLUGIN_ROOT}/skills/03-prd/assets/prd-template.md`: PRD body template.
- `${CLAUDE_PLUGIN_ROOT}/skills/03-prd/assets/task-template.md`: Lightweight task template referenced from the PRD when needed.

## External data

- None.
