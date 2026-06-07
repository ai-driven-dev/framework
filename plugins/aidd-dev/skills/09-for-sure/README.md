← [aidd-framework](../../../../README.md) / [aidd-dev](../../README.md)

# 09 - for-sure

Autonomous loop that runs until a `success_condition` is verified. Two
phases: interactive pre-flight (human present), then autonomous execution
(human gone). The agent auto-accepts everything, acts as the user, and
never stops until the success condition holds.

## When to use

- The user says "for sure", "make sure", "keep trying until", "loop until
  done", "don't stop until", or otherwise requests guaranteed completion.
- A long-running task with an explicit, verifiable success condition can
  run unattended.
- You need a retry loop that tracks attempts in a durable tracking file.

## When NOT to use

- No verifiable success condition exists → define one first, or use a
  one-shot skill.
- The task is part of a standard SDLC pipeline → use
  [00-sdlc](../00-sdlc/README.md).
- The task is a single bug fix → use [08-debug](../08-debug/README.md).
- The task needs human gates mid-loop - this skill auto-accepts and never
  asks once it enters Phase 2.

## How to invoke

```
/for-sure
```

The skill exposes 3 actions across two phases:

1. `init-tracking` (Phase 1, interactive) - pre-flight validation,
   create the tracking file, spawn the first autonomous agent.
2. `auto-accept` (Phase 2) - activate auto-accept mode for the
   autonomous run.
3. `autonomous-loop` (Phase 2) - orchestrator that spawns one worker per
   step, verifies output, retries on failure with a meaningful change,
   evaluates the success condition.

## Outputs

- A tracking file at `aidd_docs/tasks/<task-name>.md` (state in the
  `status` frontmatter field) following the plan template format from
  [01-plan](../01-plan/README.md).
- Per-attempt log entries inside the tracking file.
- The tracking file's `status` set to `done` once and only once the
  success condition genuinely verifies.

## Prerequisites

- An explicit `success_condition` expressed as a command whose exit code
  (or output) decides success.
- Acceptance criteria and steps documented in the tracking file.
- Task-specific secrets validated during pre-flight (Phase 1).

## Technical details

See [`SKILL.md`](SKILL.md) for the iron rules (single source of truth,
no repeated failures, honesty over escape, auto-accept) and
[`actions/`](actions/) for the per-phase contracts. The tracking file
uses the plan template asset from the `01-plan` skill.
