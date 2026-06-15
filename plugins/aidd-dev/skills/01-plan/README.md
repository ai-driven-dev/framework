← [aidd-framework](../../../../README.md) / [aidd-dev](../../README.md)

# 01 - plan

Generates technical implementation plans, and defines a frontend page's
design - component behaviors as state machines plus the dumb/smart split that
delegates the visual to the design tool. The plan file is the single source of
truth that downstream skills (`02-implement`, `05-review`) consume.

## When to use

- A validated spec or ticket exists and you need a phased plan with
  milestones, rules, and acceptance criteria before any code change.
- A frontend page/feature needs its design pinned down before implementation:
  component behavior (state machines), the dumb/smart split, and whether to
  render it.

## When NOT to use

- You already have a plan and need to write code → use
  [02-implement](../02-implement/README.md).
- The task is a single fix with no planning surface → use
  [08-debug](../08-debug/README.md) or edit directly.
- You want spec drafting, not planning -> use the project's spec-drafting capability.

## How to invoke

```
Use skill aidd-dev:01-plan
```

The skill exposes 2 actions:

1. `plan` - produce a phased implementation plan from a spec or ticket.
2. `design` - define a frontend page's design: component behavior (state
   machines), the dumb/smart split, and the render decision.

## Outputs

- A plan file in `aidd_docs/plans/` with frontmatter, M/C/D (must / could /
  done), rules table, and ordered phases.
- A frontend page design: state machines (Mermaid), the dumb/smart split, and
  the render flag.

## Prerequisites

- A validated spec, ticket, or design source as input.
- Access to the plan template asset bundled with this skill.

## Technical details

See [`SKILL.md`](SKILL.md) for the action list and
[`assets/plan-template.md`](assets/plan-template.md) for the canonical plan
format. Per-action contracts live in [`actions/`](actions/).
