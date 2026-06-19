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

1. **Resolve the plan (fail-fast).** Resolve the plan from `$ARGUMENTS`. When it is a path, the file must exist and be readable. If neither a readable plan file nor inline plan content is available, stop immediately with the error `plan not found at <path>` and do nothing else. Never fabricate a substitute plan.
2. **Branch.** Create a new branch if the plan specifies one (`git checkout -b <branch>`).
3. **Phase loop.** For each phase listed in the plan, in order:
   - Spawn the `implementer` agent via the `Task` tool, passing the phase scope and acceptance criteria.
   - Wait for the agent's structured output. If `completion_score < 100`, re-spawn with `items_remaining` until the phase reaches 100 %.
4. **Plan amendments.** If a phase is incorrect, incomplete, or blocked by missing information, amend the plan directly. Mark every change with 🤖 and a brief rationale.
5. **Boundaries.** Never format code. Never run dev mode. Follow project rules already loaded in context.
6. **Verify the feature.** Run validation commands, tests, and any manual checks required to confirm the feature works end to end.

## Test

- A missing or unreadable plan path with no inline plan content stops the skill with `plan not found at <path>`, and no substitute plan is fabricated.
- After the loop terminates, every phase has its acceptance criteria checked off, validation commands exit zero, and no plan section is left in a `TBD` or `BLOCKED` state.
