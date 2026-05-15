← [aidd-framework](../../../../README.md) / [aidd-dev](../../README.md)

# 04 - audit

Performs a deep codebase audit to identify technical debt, dead code, rule
violations, and improvement opportunities. Produces a structured report
that can feed planning or refactoring work.

## When to use

- You want a global health check of the codebase against project rules.
- You're preparing a refactor and need a prioritized list of debt items.
- A new contributor (or a stale repo) needs to surface hidden problems.

## When NOT to use

- A specific bug is already known → use [08-debug](../08-debug/README.md).
- You want to fix the problems immediately → use
  [07-refactor](../07-refactor/README.md) after the audit.
- You want a per-PR code review → use [05-review](../05-review/README.md).

## How to invoke

```
Use skill aidd-dev:04:audit
```

The skill exposes 1 action:

1. `audit` - scan the codebase against project rules, surface dead code,
   technical debt, and improvement candidates, then emit a structured
   report.

## Outputs

- A structured audit report listing findings with severity, location, and
  rationale.
- A prioritized list of debt items that can be lifted into a plan.

## Prerequisites

- Project rules loaded in context (the audit grades against them).
- Read access to the full codebase from the runtime.

## Technical details

See [`SKILL.md`](SKILL.md) and
[`actions/01-audit.md`](actions/01-audit.md) for the audit contract and
the report shape.
