---
name: 09-for-sure
description: Iterative agent loop that tracks attempts and retries until a success condition is met. Use when the user says "for sure", "make sure", "keep trying until", "loop until done", "don't stop until", or needs guaranteed completion of a task with explicit success criteria.
argument-hint: init-tracking | auto-accept | autonomous-loop
---

# For Sure

Autonomous loop that runs until a success condition is verified. Two phases: interactive pre-flight (human present), then autonomous execution (human gone). The agent auto-accepts everything, acts as the user, and never stops until success.

## Context

- **Goal**: Task's `success_condition` verified by running a command. All steps/acceptance criteria checked. `status` set to `implemented`.
- **Tools required**: Agent tool (spawning iterations), Read/Write/Edit (tracking file), task-specific tools.
- **Trigger**: Manual - `/for-sure`.
- **Tracking file format**: Uses the local `plan-template.md` (`@assets/plan-template.md`). Filename: `aidd_docs/tasks/<task-name>.md` (state lives in the `status` frontmatter field).

## Environment

None - task secrets are validated during pre-flight and documented in the tracking file.

## Transversal rules

1. **Single source of truth**: IF information about the task exists THEN it lives in `aidd_docs/tasks/<task-name>.md` and nowhere else.
2. **No repeated failures**: IF approach X failed THEN do not try X again without a meaningful change.
3. **Honesty over escape**: IF success condition is not genuinely met THEN do not set `status: implemented`.
4. **Auto-accept**: IF a decision, approval, or action is needed THEN act as the user. Create accounts, generate keys, approve prompts, install tools. Do not ask, do not hesitate, just do it.

## Execution flow

### Phase 1 - Interactive (human present)

1. `@actions/01-init-tracking.md` - Pre-flight, create tracking file, spawn first autonomous agent.

### Phase 2 - Autonomous (human gone)

2. `@actions/02-auto-accept.md` - Auto-accept mode activation (Phase 3).
3. `@actions/03-autonomous-loop.md` - Orchestrator: spawns one worker per step, verifies, checks/retries, evaluates success.

## Actions

```markdown
@actions/01-init-tracking.md
@actions/02-auto-accept.md
@actions/03-autonomous-loop.md
```

## References

- `@assets/plan-template.md` - tracking file format (frontmatter, phases, acceptance criteria, Log)
