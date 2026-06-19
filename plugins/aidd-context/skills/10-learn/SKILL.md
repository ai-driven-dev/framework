---
name: 10-learn
description: Capture durable project learnings from the conversation or the project's git history and route them to memory, a decision record, a rule, or a new skill. Use when the user asks to capture, record, or remember a decision, a convention, or a lesson, or to distill what recent work taught. Scores each candidate and confirms before writing. Not for personal or AI preferences, routine edits, or anything already captured.
argument-hint: gather | assess | write | sync
---

# Learn

Turns what a piece of work taught into the project's lasting context. It reads a source, scores each lesson, asks the user what to do with each, and writes only what the user approves.

## Actions

| #   | Action   | Role                                                   | Input             |
| --- | -------- | ------------------------------------------------------ | ----------------- |
| 01  | `gather` | Pick a source and collect candidate lessons             | the trigger       |
| 02  | `assess` | Score each lesson, propose a destination, ask the user  | the candidates    |
| 03  | `write`  | Write the approved lessons to their destinations        | the approved plan |
| 04  | `sync`   | Refresh the memory block in every context file          | the written files |

Order: `01 → 02 → 03 → 04`. Run each action's `## Test` before the next. When nothing is worth learning, `01` exits and the rest is skipped.

## Destinations

- **Memory.** A fact or convention. Update the matching memory file.
- **Decision.** A choice with a rationale. A record in `aidd_docs/memory/internal/decisions/`, written from the decision template.
- **Rule.** A convention to enforce. Handed to the rule generator, never written here.
- **Skill.** A reusable workflow. Handed to the skill generator, never written here.

## Transversal rules

- Ask before you write. For every lesson, show its score and proposed destination, and let the user keep it, move it, or skip it. Write nothing anywhere until the user answers.
- Default to not capturing. The score is the brake. Recommend the bar at 6 of 10.
- Learn needs an existing memory bank. If `aidd_docs/memory/` is absent, route to the project-memory skill, do not scaffold here.
- Capture the user's project, never AIDD's own scaffold.
- Touch only what a lesson affects. Preserve the user's edits. Write files, never display their content.

## Assets

- `assets/decision-template.md`: the decision record format.
