← [aidd-framework](../../../../README.md) / [aidd-dev](../../README.md)

# 07 - refactor

Improves code without breaking behavior across four axes: cleanup
(clean-code + tech debt), performance, security, and architecture. It is
the act-side counterpart of [04-audit](../04-audit/README.md) - audit
reports, refactor fixes.

## When to use

- You want to clean up, optimize, harden, or restructure existing code.
- An [04-audit](../04-audit/README.md) report flagged issues to fix now -
  push the report into refactor and it fixes the listed findings.
- A profile, security review, or coupling problem points to a concrete
  improvement.

## When NOT to use

- You only want a read-only diagnosis → run [04-audit](../04-audit/README.md).
- The task is a functional bug fix → use [08-debug](../08-debug/README.md).
- You want to add new behavior, not improve existing → use
  [02-implement](../02-implement/README.md).
- You want to add tests → [06-test](../06-test/README.md).

## How to invoke

```
Use skill aidd-dev:07-refactor
```

Run-one or run-all:

- Name an axis (`optimize`, `harden`, `clean up`, `restructure`) → that axis.
- Unscoped (`refactor this`) → the skill asks "all applicable axes, or a
  specific one?", then runs the chosen one or all.

The four axes (each maps to an audit pillar):

1. `performance` - N+1, hot paths, batching, memoization.
2. `security` - OWASP, validation, authz, secrets (may change behavior to
   close a hole).
3. `cleanup` - clean-code: rename, extract, DRY, dead-code, complexity.
4. `architecture` - extract layers, fix coupling, enforce boundaries.

## Audit handoff (push, never pull)

Refactor never loads the audit skill. Each axis runs **standalone** (scans
its lens, then fixes) or **audit-fed** when the caller pushes an
`audit_report` (path under `aidd_docs/tasks/audits/` or pasted findings) -
then it fixes that report's findings for its axis and skips its own scan.
The bridge is the report artifact, not a cross-skill dependency.

## Outputs

- Code changes scoped to the axis, with a list of `changes_applied`.
- Behavior-preserving verification (tests / types / side-by-side) for
  cleanup, performance, architecture; an explicit behavior-change call-out
  for security.

## Prerequisites

- Tests in place so the refactor is verifiable (or scheduled via
  [06-test](../06-test/README.md)).
- For the architecture axis: the documented architecture (C4 / ADRs) in
  `aidd_docs/memory/` to enforce against; large moves may need
  [01-plan](../01-plan/README.md) first.

## Technical details

See [`SKILL.md`](SKILL.md) for routing + the push-not-pull audit handoff,
and [`actions/`](actions/) for each axis contract.
