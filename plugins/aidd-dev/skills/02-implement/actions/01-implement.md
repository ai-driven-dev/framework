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

1. **Branch.** Create a new branch if the plan specifies one (`git checkout -b <branch>`). Set `status: in-progress` on the plan.
2. **Phase loop.** For each phase listed in the plan, in order:
   - Spawn the `implementer` agent via the `Task` tool, passing the phase scope and acceptance criteria.
   - Wait for the agent's structured output. If `completion_score < 100`, re-spawn with `items_remaining` until the phase reaches 100 % or the retry budget in the blocked reference is spent (→ step 6).
3. **Plan amendments.** If a phase is incorrect, incomplete, or blocked by missing information, amend the plan directly. Mark every change with 🤖 and a brief rationale.
4. **Boundaries.** Never format code. Never run dev mode. Follow project rules already loaded in context.
5. **Verify the feature.** Run validation commands, tests, and any manual checks required to confirm the feature works end to end.
6. **Blocked.** If the implementer surfaces `BLOCKED` in its notes, or the retry budget (blocked reference) is spent, set `status: blocked`, stop the loop, and escalate to a human — never fake `done`.
7. **Mark done.** Every phase at 100% + validation passes → set `status: done`.

## Test

After the loop terminates: every phase has its acceptance criteria checked off, validation commands exit zero, and the plan carries `status: done` — OR, if a blocking condition held, the loop stopped and the plan carries `status: blocked`.
