← [aidd-framework](../../../../README.md) / [aidd-dev](../../README.md)

# 02 - implement

Executes an existing implementation plan phase by phase, iterating until every acceptance criterion is satisfied. Tracks status in the plan and phase frontmatter as it goes.

## When to use

- A plan produced by [01-plan](../01-plan/README.md) is ready and you need the code written against it.
- An iteration of [00-sdlc](../00-sdlc/README.md) delegates the implement step.

## When NOT to use

- No plan exists yet → use [01-plan](../01-plan/README.md) first.
- The plan is wrong and needs replanning → replan with [01-plan](../01-plan/README.md); this skill never rewrites the plan.
- A bug fix with no plan surface → use [08-debug](../08-debug/README.md).

## How to invoke

```
Use skill aidd-dev:02-implement
```

Pass the plan path or content as the arguments. The skill runs three actions in order:

1. **prepare**: fails fast when the plan is missing (never fabricates one); puts `HEAD` on a feature branch when it is on the default branch, otherwise keeps the current branch; sets the plan `status: in-progress`.
2. **execute**: loops the plan's phases: per phase it sets `status: in-progress` as a runtime marker, codes the phase, asserts it clean, then commits the phase and sets `status: done`; stops at `status: blocked` on a human-only condition.
3. **finalize**: runs validation, then marks the plan `status: implemented` once every phase is done.

**Commits**: code and status are committed together, one commit per phase, plus a final `implemented` commit. The `in-progress` marks are runtime-only, so the tree is never left dirty at a phase boundary.

## Outputs

- Code for the feature, one phase at a time, committed on the active feature branch, one commit per phase.
- Plan and phase frontmatter status driven `pending → in-progress → done / implemented`, or `blocked`.
- A `replan needed` report when the plan no longer matches reality; this recipe never rewrites the plan.

## Prerequisites

- A plan file with phases and acceptance criteria, from `01-plan`.
- Project conventions honoured by whoever runs the recipe.

## Technical details

See [`SKILL.md`](SKILL.md) and [`actions/`](actions/) for the prepare/execute/finalize split: the branch guard, the phase loop, the assert gate, the status lifecycle, and the boundary constraints (no formatting, no dev mode).
