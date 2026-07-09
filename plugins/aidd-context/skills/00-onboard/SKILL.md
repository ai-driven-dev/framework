---
name: 00-onboard
description: Onboard onto an AIDD project by scanning what is set up and missing, then guiding the single next action to run. Use when the user says onboard me, onboard this project, get me started, where do I start, what should I do next, or how does this project stand. Not for listing every installed surface.
argument-hint: scan | assess | present | run
---

# Onboard

Scans the current project against the AIDD framework, tells the user in plain words where it stands, points to the single clearest next action, and runs it on request.

## Actions

| #   | Action   | Role                                                                                     | Input            |
| --- | -------- | ---------------------------------------------------------------------------------------- | ---------------- |
| 01  | `scan`   | Read the project once, silently, into a snapshot: every check in `checks.md`, status per zone | project root     |
| 02  | `report` | Lead with one plain state sentence and one recommended action a first-timer can act on, dashboard demoted | the 01 snapshot  |
| 03  | `run`    | Run the user's pick per its tier, `OK` walks the pending steps pausing at each interactive one, then re-scan | the user's reply |

Run `01 → 02 → 03`, then loop back to `01` after each run until the user stops. Run each action's `## Test` before the next. Before running an action, read its file in `actions/`, not only the table or assets.

## References

- `references/checks.md`: the diagnostic catalogue, four zones ordered, each check with its met rule, drift rule, deliverable, command, and run tier.
- `references/run-tiers.md`: the AUTO, GUIDED, and MANUAL run tiers, how `OK` chains them, the loop, and explain-on-demand.

## Assets

- `assets/report.md`: the report shape action 02 renders.

## Transversal rules

- Guide, do not lecture or dump. Lead with where the project stands and the single clearest next action, and keep the rest on demand. The render shape is `assets/report.md`.
- Name real commands only. Never name a command whose skill `01` did not find installed; name a missing one as a gap by function.
- Never run a GUIDED step unattended, and never test a plugin version against a registry.
- Re-scan after a run, never trust a stale status. Wait for an explicit reply before running anything.

## External data

- `../02-project-memory/references/memory-block.md`: the canonical `<aidd_project_memory>` block shape the form-drift check compares against.
