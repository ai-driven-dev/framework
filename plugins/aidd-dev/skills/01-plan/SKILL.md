---
name: 01-plan
description: Turn a request, ticket, or file into a phased implementation plan: gather the source, explore the codebase, optionally wireframe a screen, then plan. Use when the user wants to plan a feature, turn a ticket or requirements into a phased plan, or wireframe a screen before building. Do NOT use to write code (use 02-implement), review a diff (use 05-review), or audit code (use 04-audit).
---

# Skill: plan

Turn a gathered source into an implementation plan and its phase files. Never writes code.

## Actions

| #   | Action      | Role                                                 | Input                      |
| --- | ----------- | ---------------------------------------------------- | -------------------------- |
| 01  | `gather`    | Collect and restate the source                       | user request               |
| 02  | `explore`   | Read the codebase for projection, rules, feasibility | gathered source            |
| 03  | `wireframe` | Sketch a screen at low fidelity, frontend only       | source + explore context   |
| 04  | `plan`      | Break into phases, write the plan and phase files    | explore output + wireframe |

Run them in order, `01 → 04`. The plan is the culmination. Skip `03` when there is no UI.

## References

- `references/mermaid-conventions.md`: conventions for the Mermaid diagrams a phase embeds.
- `references/wireframe-conventions.md`: how to draw the ASCII wireframe a screen needs.
- `references/plan-status.md`: the plan lifecycle `status` values and who writes each.

## Assets

- `assets/plan-template.md`: the `plan.md` scaffold.
- `assets/phase-template.md`: the per-phase scaffold.
