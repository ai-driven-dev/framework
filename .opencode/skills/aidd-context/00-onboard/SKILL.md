---
name: aidd-context:00:onboard
description: Detect the project's aidd-context state and guide the user to one concrete next aidd-context action through a state -> recommend -> execute loop. Use when the user says "where do I start", "I'm new to this plugin", "onboard me", "what should I run next", "guide me through aidd-context", or invokes `aidd-context:00:onboard`. Do NOT use to enumerate every installed skill from raw user intent (a dedicated discovery skill in this plugin handles that), and do NOT use to teach the global cross-plugin AIDD flow (a separate cross-plugin onboard owns that scope).
model: opus
---

# Onboard

State-aware guided tour of the aidd-context plugin. Looks at what already exists in the project, picks the single next aidd-context action that fits, and walks the user there. Loops until the user is set up or explicitly stops.

## Available actions

| #   | Action                | Role                                                                          | Input                  |
| --- | --------------------- | ----------------------------------------------------------------------------- | ---------------------- |
| 01  | `detect-state`        | Probe filesystem to snapshot the project's aidd-context onboarding state      | project root           |
| 02  | `recommend-next`      | Map state to ONE next aidd-context skill, render numbered choice menu         | state snapshot from 01 |
| 03  | `execute-or-handoff`  | Run the chosen skill in-session, hand it off to a new session, or explain it  | user choice from 02    |

## Default flow

`01 -> 02 -> 03 -> back to 01` after each execute or handoff, until the user picks "stop" or no further aidd-context action is recommended. Run each action's `## Test` before moving to the next.

## Transversal rules

- ONE next action at a time. Stage 1 (filesystem) auto-recommends at most one skill. Stage 2 (intent menu) asks the user to identify their situation; each option still maps to exactly one skill.
- Two-stage decision. `01-detect-state` only matches setup-related rows from the filesystem. If no setup gap is detected, the recommendation is `ask`, and `02-recommend-next` renders the intent menu before proposing a skill.
- Numbered choices only. The user replies with a digit. Free-text replies trigger a re-render of the same menu with a one-line reminder.
- Never assume the user will run the skill inside this conversation. Always offer: run-in-session, explain, hand off to a new session, pick a different option, stop.
- Always loop back to `01-detect-state` after a skill runs or is handed off. The project state changes; re-detect before re-recommending.
- Scope is strictly aidd-context skills (`01-bootstrap`, `02-project-init`, `03-context-generate`, `04-mermaid`, `05-learn`, `06-discovery`). Never recommend a skill from another plugin.
- `06-discovery` is intent-only. Never auto-recommend it from Stage 1. It is reachable only when the user picks the corresponding Stage 2 option.
- Anti-sycophancy. If the user picks an option that conflicts with the detected state (e.g. requests `02-project-init` when memory is already populated), challenge once before complying.
- Wait for an explicit user response between every action. Do not auto-advance.

## Assets

- `assets/state-matrix.md` - decision table mapping detected state to the next aidd-context skill

## References

- aidd-context plugin README - source of truth for the six aidd-context skills and their order
