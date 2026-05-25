---
name: aidd-context:05:learn
description: Capture and store project-level learnings, conventions, and decisions surfaced during work into memory, decisions, or rules. Use proactively when the user states a durable project rule or convention ("for next", "always do X", "from now on", "going forward", "rule:", "convention:"), records a technical decision and its rationale, deprecates something, or notes an insight that should outlive the current task. Do NOT use for personal or AI-preference reminders (those belong to user memory), routine code edits, minor fixes, or anything already captured.
---

# Skill: learn

Updates memory bank, decisions, and rules to keep project context accurate after implementation.

## Rules

- Less is more. Documentation stays concise and to the point.
- Avoid putting too much information.
- Focus on important changes or non-alignments with existing docs.
- Memory must ALWAYS be up-to-date.

## Available actions

| #   | Action     | Role                                                                       | Input                  |
| --- | ---------- | -------------------------------------------------------------------------- | ---------------------- |
| 01  | `scope`    | Worth-learning check, auto-analyze, categorize, user approval              | conversation signal    |
| 02  | `write`    | Create or update files for each approved item                              | approved plan from 01  |
| 03  | `sync`     | Refresh `<aidd_project_memory>` block in installed AI context files        | summary table from 02  |

## Default flow

`01 → 02 → 03`. Action 01 exits cleanly when nothing is learning-worthy (Phase 1 gate); 02 and 03 are skipped in that case.

## Assets

- `${CLAUDE_PLUGIN_ROOT}/skills/05-learn/assets/decision-template.md` - individual decision record template
- `${CLAUDE_PLUGIN_ROOT}/skills/05-learn/assets/adr-template.md` - ADR log template
