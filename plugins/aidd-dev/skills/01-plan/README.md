# 01 - plan

Generates technical implementation plans, defines component behaviors as
state machines, and extracts structured component inventories from design
images. The plan file is the single source of truth that downstream skills
(`02-implement`, `05-review`) consume.

## When to use

- A validated spec or ticket exists and you need a phased plan with
  milestones, rules, and acceptance criteria before any code change.
- A frontend component needs its behavior pinned down as a state machine
  before implementation.
- A design image (Figma export, mockup, screenshot) needs to be turned into
  a hierarchical component inventory.

## When NOT to use

- You already have a plan and need to write code → use
  [02-implement](../02-implement/README.md).
- The task is a single fix with no planning surface → use
  [08-debug](../08-debug/README.md) or edit directly.
- You want spec drafting, not planning -> use the project's spec-drafting capability.

## How to invoke

```
Use skill aidd-dev:01:plan
```

The skill exposes 3 actions:

1. `plan` - produce a phased implementation plan from a spec or ticket.
2. `components-behavior` - define a component's behavior as a state machine.
3. `image-extract-details` - analyze a design image and emit a hierarchical
   component inventory.

## Outputs

- A plan file in `aidd_docs/plans/` with frontmatter, M/C/D (must / could /
  done), rules table, and ordered phases.
- A state-machine description (Mermaid) for the target component.
- A structured component inventory derived from the image source.

## Prerequisites

- A validated spec, ticket, or design source as input.
- Access to the plan template asset bundled with this skill.

## Technical details

See [`SKILL.md`](SKILL.md) for the action list and
[`assets/plan-template.md`](assets/plan-template.md) for the canonical plan
format. Per-action contracts live in [`actions/`](actions/).
