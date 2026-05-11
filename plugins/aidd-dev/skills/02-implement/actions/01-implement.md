---
name: implement
description: Implement a plan phase by phase using the implementer agent, iterating until 100% completeness.
argument-hint: The technical plan to implement
model: sonnet
---

# Goal

Code the whole feature based on the implementation plan, phase by phase, sequentially.

## Rules

- Follow all project rules @{{TOOLS}}/rules/
- Never format code
- Never run dev mode
- If a phase is incorrect, incomplete, or blocked by missing information, amend the plan directly. Mark every change with 🤖 and a brief rationale.

## Context

### Implementation plan

```text
$ARGUMENTS
```

## Process steps

1. Create a new branch if specified in the plan.
2. Spawn the `implementer` agent (via Task) for the current phase, passing the phase scope and acceptance criteria.
3. Wait for the agent's structured output. If `completion_score < 100`, re-spawn with `items_remaining` until the phase reaches 100%.
4. Iterate phase by phase until nothing more can be done.
5. Verify the feature has been correctly made using any necessary means (validation commands, tests, manual checks).
