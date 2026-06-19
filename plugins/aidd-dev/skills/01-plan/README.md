← [aidd-framework](../../../../README.md) / [aidd-dev](../../README.md)

# 01 - plan

Turns a request, ticket, or file into a phased implementation plan and its phase files. The plan is the single source of truth that downstream skills (`02-implement`, `05-review`) consume.

## When to use

- A spec, ticket, or request exists and you need a phased plan with deterministic acceptance criteria before any code change.
- A screen needs its layout fixed with a low-fidelity wireframe before the plan.

## When NOT to use

- You already have a plan and need to write code → use [02-implement](../02-implement/README.md).
- The task is a single fix with no planning surface → use [08-debug](../08-debug/README.md) or edit directly.
- You want spec drafting, not planning → use the project's spec-drafting capability.

## How to invoke

```
Use skill aidd-dev:01-plan
```

The skill runs three actions in order, the plan being the culmination:

1. `gather` collects the source the plan rests on and restates it. Always first.
2. `wireframe` sketches a low-fidelity ASCII layout of any screen the feature needs. Frontend only, skipped when there is no UI.
3. `plan` turns the gathered source, and any confirmed wireframe, into the plan and its phases.

A feature folder `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<feature-slug>/`:

- `plan.md` from the plan template: rules, phases, risks, decisions, external resources.
- `phase-<n>.md` per phase from the phase template: projection slice, user journey, tasks, acceptance criteria, any wireframe.

The plan reuses the folder when the source already lives in one, so a `brainstorm.md` or `spec.md` already there sits alongside, not duplicated.

## Prerequisites

- A request, ticket, or file as the source.
- The plan and phase templates bundled with this skill.

## Technical details

See [`SKILL.md`](SKILL.md) for the action flow, [`assets/plan-template.md`](assets/plan-template.md) for the plan format, and [`actions/`](actions/) for the per-action contracts.
