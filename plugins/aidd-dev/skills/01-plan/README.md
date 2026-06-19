← [aidd-framework](../../../../README.md) / [aidd-dev](../../README.md)

# 01 - plan

Generates a technical implementation plan from requirements, or designs a frontend page before building it. The plan file is the single source of truth that downstream skills (`02-implement`, `05-review`) consume.

## When to use

- A validated spec or ticket exists and you need a phased plan with milestones, rules, and acceptance criteria before any code change.
- A frontend page needs its design pinned down, component behavior as state machines and the dumb/smart split, before implementation.

## When NOT to use

- You already have a plan and need to write code → use [02-implement](../02-implement/README.md).
- The task is a single fix with no planning surface → use [08-debug](../08-debug/README.md) or edit directly.
- You want spec drafting, not planning → use the project's spec-drafting capability.

## How to invoke

```
Use skill aidd-dev:01-plan
```

The skill exposes three actions:

1. `plan` produces a phased implementation plan from requirements, saved to a task file.
2. `design` defines a frontend page's design, component behavior as state machines and the dumb/smart split, with a render decision and a delegation prompt for the implementer.
3. `wireframe` sketches a low-fidelity ASCII layout of a screen before designing it.

The planner adapts to the input and routes to the right action, it does not ask the user to choose. The actions chain naturally: wireframe a screen, then design it, then plan its build.

## Outputs

- A plan file under `aidd_docs/tasks/<yyyy_mm>/`, dated and feature-named, with execution frontmatter, the architecture projection (modify, create, delete), an applicable-rules table, and ordered phases.
- A page design with the dumb/smart split and a delegation prompt that builds the smart layer in-house and delegates each dumb visual to the design tool.
- A low-fidelity ASCII wireframe of a screen, its regions labeled, for layout validation before design.

## Prerequisites

- Requirements, a ticket, or a page to design as input.
- The plan and phase templates bundled with this skill.
- Optional: a UI-craft skill (`impeccable`) enhances the design action's visual delegation. The design action works without it, authoring dumb visuals inline.

## Technical details

See [`SKILL.md`](SKILL.md) for the action list and routing, [`assets/plan-template.md`](assets/plan-template.md) for the plan format, and [`actions/`](actions/) for the per-action contracts.
