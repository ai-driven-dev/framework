---
name: aidd-context:00:onboard
description: Detect the current project's state and open a hub of project actions - understand the project, set up or refresh the memory bank, or continue the AIDD development journey. Silently inspects the project, the AIDD setup, and which AIDD plugins are installed, then adapts the menu to that context. Use when the user says "where do I start", "onboard me", "onboard me to this project", "what should I run next", "what should I work on next", "what's the state of this project", "guide me through aidd", "guide me through aidd-context", or invokes `aidd-context:00:onboard`. Do NOT use to enumerate every installed surface from raw user intent (the discovery skill in this plugin handles that).
model: opus
---

# Onboard

State-aware onboarding hub for the current project. Silently inspects the project, the AIDD setup, and the installed AIDD plugins, then opens a briefing and a menu: understand the project, set up or refresh the memory bank, or continue the AIDD development journey. Loops until the user stops.

## Available actions

| #   | Action               | Role                                                                       | Input                  |
| --- | -------------------- | -------------------------------------------------------------------------- | ---------------------- |
| 01  | `detect-state`       | Silently probe the project, the AIDD setup, and the installed AIDD surface  | project root           |
| 02  | `recommend-next`     | Render the briefing and the hub menu, route the pick to one concrete action | internal state from 01 |
| 03  | `execute-or-handoff` | Carry out the choice: briefing, run, explain, handoff, swap, or stop        | choice from 02         |

## Default flow

`01 -> 02 -> 03 -> back to 01` after each action, until the user picks Stop. Run each action's `## Test` before moving to the next.

## Transversal rules

- Hub, not a track. Onboard shows a briefing and a menu of project actions; it never forces a single next step.
- Silent detection. `01-detect-state` prints nothing - no `state:` snapshot, no signal dump, no `Analysis:` label ever reaches the user. The first visible output is the briefing header.
- Briefing first. Every pass opens with a clean three-line briefing header: project, AIDD setup, standing.
- Categories, never hard-coded foreign skills. Onboard recommends by category - a function such as "technical planning" or "shipping" - and resolves it at runtime against the skills actually installed. It never names a skill or plugin id that is not installed.
- Honest gaps. A category that resolves to no installed skill is reported as a gap, described by function. Onboard never invents a skill to fill it.
- `sdlc_phase` is a hint, never a verdict. Onboard shows where the project seems to stand but always lets the user pick the SDLC leg. It never assumes a phase is finished or unfinished.
- Numbered choices only. The user replies with a digit. Free-text replies re-render the same menu with a one-line digit reminder.
- Never assume the user will run a skill in this conversation. For a resolved skill always offer: run-in-session, explain, hand off to a new session, swap, stop.
- Always loop back to `01-detect-state` after an action runs or is handed off. The project state changes; re-detect before re-rendering.
- Anti-sycophancy. If the user picks an option that conflicts with the detected state, challenge once before complying.
- Wait for an explicit user response between every menu. Do not auto-advance.

## Assets

- `assets/state-matrix.md` - the hub menu, the SDLC sub-menu, the AIDD journey backbone, and the category resolution rules

## References

- The AI tool's native plugin and skill discovery - the runtime source of truth for which categories onboard can resolve to a real skill
