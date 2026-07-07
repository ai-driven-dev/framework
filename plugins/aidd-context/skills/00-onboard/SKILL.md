---
name: 00-onboard
description: Scan an AIDD project into a diagnostic of what is set up and missing, then run the recommended next commands in order. Use when the user asks where to start, what to do next, how the project stands, or to onboard onto AIDD. Not for listing every installed surface.
argument-hint: scan | report | run
---

# Onboard

Scans the current project against the AIDD framework, reports what is present, drifting, or missing as an explicit checklist, hands back a single ordered list of the commands to run next, and runs them on request.

## Actions

| #   | Action   | Role                                                                                     | Input            |
| --- | -------- | ---------------------------------------------------------------------------------------- | ---------------- |
| 01  | `scan`   | Read the project once, silently, into a snapshot: every check in `checks.md`, status per zone | project root     |
| 02  | `report` | Render the loud diagnostic plus one ordered command list, foundations then dev flow       | the 01 snapshot  |
| 03  | `run`    | Run the user's pick per its tier, `OK` walks the whole list pausing at each GUIDED step, then re-scan | the user's reply |

Run `01 → 02 → 03`, then loop back to `01` after each run until the user stops. Run each action's `## Test` before the next. Before running an action, read its file in `actions/`, not only the table or assets.

## References

- `references/checks.md`: the diagnostic catalogue, four zones ordered, each check with its met rule, drift rule, deliverable, command, and run tier.
- `references/run-tiers.md`: the AUTO, GUIDED, and MANUAL run tiers, how `OK` chains them, the loop, and explain-on-demand.

## Assets

- `assets/report.md`: the report shape action 02 renders.

## Transversal rules

- Report, do not lecture. State status as glyphs, never a raw label or snapshot. A plain-language explanation of a step appears only when the user asks for it.
- Name real commands only. Never name a command whose skill `01` did not find installed; name a missing one as a gap by function.
- Never run a GUIDED step unattended, and never test a plugin version against a registry.
- Re-scan after a run, never trust a stale status. Wait for an explicit reply before running anything.
- Requires only the `aidd-context` plugin installed and a working directory rooted in the target project. The `aidd_docs/` memory bank is not a prerequisite: on a project without it, the first recommendation is to set it up. Onboard is the entry point, so it works before anything else exists.

Detail lives in the references: the check catalogue and ranking in `checks.md`, the run tiers and `OK` walk in `run-tiers.md`, the render shape and glyphs in `assets/report.md`.

## External data

- `../02-project-memory/references/memory-block.md`: the canonical `<aidd_project_memory>` block shape the form-drift check compares against.
