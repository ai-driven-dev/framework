← [aidd-framework](../../../../README.md) / [aidd-dev](../../README.md)

# 02 - implement

Executes an existing implementation plan phase by phase, spawning an `implementer` agent per phase and iterating until every acceptance criterion is satisfied. Tracks status in the plan and phase frontmatter as it goes.

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

Pass the plan path or content as `$ARGUMENTS`. The skill runs three actions in order:

1. **prepare** — fails fast when the plan is missing (never fabricates one); puts `HEAD` on a feature branch when it is on the default branch, otherwise keeps the current branch; sets the plan `status: in-progress`.
2. **execute** — loops the plan's phases: per phase it sets `status: in-progress`, spawns the `implementer` agent, re-spawns with `items_remaining` until 100 %, then sets `status: done`; stops at `status: blocked` when the implementer hits a human-only condition.
3. **finalize** — runs validation, then marks the plan `status: implemented` once every phase is done.

**Code** commits are the `implementer` agent's job (one per ticked acceptance criterion); the skill commits only its own **tracking** — each status transition, the moment it makes it. That split keeps the same audit trail whether the agent is reached through this skill, the SDLC, or a direct spawn, and stops the implementer's clean-tree hygiene from reverting an uncommitted status edit.

## Outputs

- Code for the feature, one phase at a time, committed by the `implementer` agent on the active feature branch.
- Plan and phase frontmatter status driven `pending → in-progress → done / implemented`, or `blocked` — each transition committed by the skill as it happens.
- A `replan needed` report when the plan no longer matches reality; this skill never rewrites the plan.

## Prerequisites

- A plan file with phases and acceptance criteria, from `01-plan`.
- The `implementer` agent available in context.
- Project rules already loaded for the implementer to respect.

## Technical details

See [`SKILL.md`](SKILL.md) and [`actions/`](actions/) for the prepare/execute/finalize split: the branch guard, the phase loop, the re-spawn rule, the status lifecycle, and the boundary constraints (no formatting, no dev mode).
