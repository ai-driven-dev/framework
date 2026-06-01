← [aidd-framework](../../../../README.md) / [aidd-dev](../../README.md)

# 02 - implement

Executes an existing implementation plan phase by phase via the `implementer`
agent, iterating until every acceptance criterion is satisfied. Each phase
loops until the agent reports 100 % completion.

## When to use

- A plan produced by [01-plan](../01-plan/README.md) is ready and you need
  the code written end-to-end against it.
- An iteration of [00-sdlc](../00-sdlc/README.md) is delegating the
  `implement` step to this skill.

## When NOT to use

- No plan exists yet → use [01-plan](../01-plan/README.md) first.
- The plan is wrong and needs replanning → amend the plan, not the code.
- The task is a bug fix without a plan surface → use
  [08-debug](../08-debug/README.md).

## How to invoke

```
Use skill aidd-dev:02-implement
```

Pass the plan path or content as `$ARGUMENTS`. The skill exposes 1 action:

1. `implement` - loop each plan phase: spawn the `implementer` agent, wait
   for structured output, re-spawn with `items_remaining` until the phase
   hits 100 %. Branching is the caller's responsibility; this skill never
   creates branches. Plan amendments are made inline and tagged with the
   robot marker.

## Outputs

- Code changes on the active branch, one phase at a time.
- `phases_completed` count and `acceptance_satisfied: true` when done.
- Plan amendments inline in the plan file when the loop discovers gaps.

## Prerequisites

- A plan file with phases, M/C/D, and acceptance criteria.
- The `implementer` agent available in context.
- Project rules already loaded for the implementer to respect.

## Technical details

See [`SKILL.md`](SKILL.md) and
[`actions/01-implement.md`](actions/01-implement.md) for the phase loop
contract, the re-spawn rule, and the boundary constraints (no formatting,
no dev mode).
