# 01 - Implement

Code the whole feature based on the implementation plan, phase by phase, sequentially, until every acceptance criterion is satisfied.

## Inputs

```yaml
plan: <path to or content of the implementation plan, passed via $ARGUMENTS>
branch: <branch name>     # optional; created when the plan specifies one
```

## Outputs

```yaml
phases_completed: <int>
acceptance_satisfied: true
notes:
  - <plan amendments marked with 🤖>
```

## Process

1. **Branch.** Create a new branch if the plan specifies one (`git checkout -b <branch>`).
2. **Phase loop.** For each phase listed in the plan, in order:
   - Spawn the `implementer` agent via the `Task` tool, passing the phase scope and acceptance criteria.
   - Wait for the agent's structured output. If `completion_score < 100`, re-spawn with `items_remaining` until the phase reaches 100 %.
3. **Plan amendments.** If a phase is incorrect, incomplete, or blocked by missing information, amend the plan directly. Mark every change with 🤖 and a brief rationale.
4. **Boundaries.** Never format code. Never run dev mode. Follow project rules already loaded in context.
5. **Verify the feature.** Run validation commands, tests, and any manual checks required to confirm the feature works end to end.

## Test

After the loop terminates: every phase in the plan has its acceptance criteria checked off, validation commands exit zero, and no plan section is left in a `TBD` or `BLOCKED` state.
