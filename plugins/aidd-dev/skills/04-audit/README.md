← [aidd-framework](../../../../README.md) / [aidd-dev](../../README.md)

# 04 - audit

Read-only codebase audit across seven quality pillars. Diagnoses and ranks
findings into a structured report; it never edits code. Each finding hands
off to the relevant act-skill (refactor, test, impeccable) when a fix is
wanted.

## When to use

- You want a global health check of the codebase, or a deep look at one
  dimension (security, performance, dependencies, ...).
- You're preparing a refactor and need a prioritized, located list of issues.
- A new contributor (or a stale repo) needs hidden problems surfaced.

## When NOT to use

- A specific bug is already known → use [08-debug](../08-debug/README.md).
- You want to fix the problems → run the audit first, then the act-skill it
  hands off to ([07-refactor](../07-refactor/README.md),
  [06-test](../06-test/README.md), or the `impeccable` skill for UI).
- You want a per-PR code review → use [05-review](../05-review/README.md).
- You want to validate a feature works → use [03-assert](../03-assert/README.md).

## How to invoke

```
Use skill aidd-dev:04-audit
```

Run-one or run-all:

- Name a pillar (`audit security`, `perf audit`) → one pillar.
- Ask for a full audit (`/audit`, "health check") → the skill asks "full or a
  specific pillar?", then scans all applicable pillars into one merged report.

The seven pillars:

1. `code-quality` - clean code (naming, SOLID, DRY, smells) + tech debt.
2. `architecture` - C4 / ADR conformance, coupling, boundaries, layering.
3. `security` - OWASP, authz, input validation, secrets.
4. `dependencies` - CVEs, licenses, outdated and unused deps.
5. `performance` - N+1, hot paths, bundle size, heavy operations.
6. `tests` - critical-path coverage, flakiness, pyramid balance.
7. `ui` - states, visual hierarchy, design-system drift, responsive, a11y.

## Outputs

- One structured report: a findings table (severity, pillar, `file:line`,
  issue, fix, effort), a ranked Top-actions list, and a Coverage section
  proving which pillars were scanned (and which were skipped, with reason).

## Prerequisites

- Project rules and architecture docs loaded in context (the audit grades
  against them).
- Read access to the codebase.
- For tool/runtime pillars (dependencies, performance, tests, ui): the
  relevant tool when available; otherwise that pillar degrades or is skipped
  with a recorded reason.

## Technical details

See [`SKILL.md`](SKILL.md) for the routing + output contract, the
`actions/0X-<pillar>.md` files for each pillar's lens and method, and
[`assets/audit-template.md`](assets/audit-template.md) for the report shape.
