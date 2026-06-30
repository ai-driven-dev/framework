---
name: 00-onboard
description: Guide the user through AIDD on the current project: explain the flow and the next step for what is set up. Use when the user asks where to start, what to do next, or how AIDD works. Not for listing installed surfaces or running a known skill.
argument-hint: read-project | orient | act
---

# Onboard

A plain-language guide to the AIDD framework for the current project. It reads the project lightly, explains where the project sits in the AIDD flow, and suggests the next logical step using only the plugins that are installed. It loops until the user stops.

## Actions

| #   | Action         | Role                                                              | Input             |
| --- | -------------- | ---------------------------------------------------------------- | ----------------- |
| 01  | `read-project` | Lightly and silently read the project and the installed skills    | project root      |
| 02  | `orient`       | Explain where the project sits and suggest the next step, in plain language | the read from 01  |
| 03  | `act`          | Run the suggestion, explain it, teach the flow, switch step, or stop | the user's choice |

Run `01 → 02 → 03`, then loop back to `01` after each step until the user stops. Run each action's `## Test` before the next.

## Transversal rules

- Teach, do not assume. The user may be new to AIDD. Explain a term the first time it appears (the memory bank is the project memory the AI loads each session), never assume framework literacy.
- Suggest, never force. Show where the project seems to stand and the next logical step, and always let the user choose another.
- Plain language only. No internal state names, no raw phase labels, no signal dump reaches the user. The user reads guidance, not a state machine.
- Adapt to what is installed. Suggest by function and resolve it to a skill that is actually installed. If none is installed, name the missing capability by function, never invent a skill.
- Silent read. `01-read-project` prints nothing. The first visible output is the plain briefing from `02-orient`.
- Read once, then refresh on action. Read the project once into a reusable snapshot; after the user runs a step, re-derive the changed facts and mark that step done in the session ledger; a read-only choice reuses the snapshot. The ledger is how onboard knows a step is done even when it leaves no file behind.
- Wait for an explicit reply between prompts. Never auto-advance.

## References

- `references/journey.md`: the AIDD flow stages, what each unblocks, and how a step resolves to an installed skill.
