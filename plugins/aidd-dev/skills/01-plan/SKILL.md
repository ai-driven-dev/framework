---
name: 01-plan
description: Turn a request, ticket, or file into a phased implementation plan, gathering the source first and optionally wireframing a screen before planning. Use when the user wants to plan a feature, turn a ticket or requirements into a phased plan, or wireframe a screen before building. Do NOT use to write code (use 02-implement), review a diff (use 05-review), or audit code (use 04-audit).
---

# Skill: plan

Turn a gathered source into an implementation plan and its phase files. Never writes code.

## Actions

Run them in order. The plan is the culmination.

1. `@actions/01-gather.md`: collect and restate the source. Always first.
2. `@actions/02-wireframe.md`: sketch any screen the feature needs. Frontend only, skip when there is no UI.
3. `@actions/03-plan.md`: turn the gathered source, and any confirmed wireframe, into the plan and its phases.

## References

- `@references/mermaid-conventions.md`: conventions for the Mermaid diagrams a phase embeds.

## Assets

- `@assets/plan-template.md`: the `plan.md` scaffold. Its header comment carries the field rules.
- `@assets/phase-template.md`: the per-phase scaffold. Its header comment carries the field rules.
