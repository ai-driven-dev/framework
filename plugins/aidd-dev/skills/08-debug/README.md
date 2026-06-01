← [aidd-framework](../../../../README.md) / [aidd-dev](../../README.md)

# 08 - debug

Reproduces and fixes bugs systematically using a test-driven workflow:
reproduce the failure, reflect on hypotheses, validate with logs, then
apply a targeted fix. Drives the loop from issue to PR.

## When to use

- A bug is reported and you want a disciplined reproduce → diagnose →
  fix → verify loop.
- A flaky test or intermittent failure needs root-cause analysis backed by
  validation logs.
- An issue exists in the tracker and you want to ship the fix as a PR.

## When NOT to use

- The work is new feature development → use
  [00-sdlc](../00-sdlc/README.md) or
  [02-implement](../02-implement/README.md).
- The fix is a refactor with no behavioral defect → use
  [07-refactor](../07-refactor/README.md).
- You want broad coverage analysis, not one bug → use
  [04-audit](../04-audit/README.md).

## How to invoke

```
Use skill aidd-dev:08-debug
```

The skill exposes 3 actions:

1. `reproduce` - produce a deterministic reproduction (failing test or
   command).
2. `debug` - diagnose the root cause and apply the fix.
3. `reflect-issue` - enumerate likely causes, rank them, add validation
   logs before committing to a hypothesis.

## Outputs

- A failing reproduction (test or script) that turns green after the fix.
- A root-cause note attached to the issue or PR.
- Targeted fix commits scoped to the defect.
- Updated tests covering the regression.

## Prerequisites

- An issue or report describing the failure (stack trace, repro steps,
  expected vs observed).
- Test infrastructure able to host the reproduction.

## Technical details

See [`SKILL.md`](SKILL.md) and [`actions/`](actions/) for the three
debug contracts. The reflect-issue action explicitly mandates logs before
acting, to prevent jumping to the wrong hypothesis.
