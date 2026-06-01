# 04 - Architecture

Enforce documented boundaries, fix wrong-direction dependencies, and decouple structural problems - in small, verifiable steps that preserve observable behavior where possible.

## Inputs

```yaml
scope: <directory or file glob>   # optional; defaults to the entire codebase
audit_report: <optional - path to a report under aidd_docs/tasks/audits/ or pasted findings>
constraints:
  - keep public inputs and outputs identical where structurally possible
  - proceed in small verified steps
```

## Outputs

```yaml
changes_applied:
  - { file: <path>, change: <one-line summary>, severity: "🔴|🟡|🟢" }
verification: <summary of test, type-check, and import-graph results confirming no behavioral regression>
deferred_to_plan:
  - <structural move too large for direct execution - route to aidd-dev:01-plan first>
```

## Process

1. **Source findings.** Two modes:
   - If `audit_report` is provided: extract the architecture-axis findings from that report and use them as the fix list. Skip the standalone scan below.
   - Else (standalone): scan the scope against documented boundaries (C4 diagrams or ADRs in `aidd_docs/memory/`). Identify wrong-direction dependencies, god-modules, missing layer abstractions, and violated isolation contracts. Rate each issue with the 3-level severity scale: 🔴 critical, 🟡 warning, 🟢 minor.
2. **Triage findings.** Separate changes that are safe to apply atomically now from those that require broad coordinated moves. Place the latter in `deferred_to_plan`.
3. **Apply changes** in small, independently verifiable steps:
   - Extract or restore layers (separate domain, infrastructure, and presentation concerns).
   - Fix wrong-direction dependency arrows (introduce an interface or inversion point; do not let infrastructure reach into domain).
   - Decouple god-modules by splitting responsibilities along natural seams.
   - Enforce documented boundaries by moving code, adjusting exports, and updating internal references.
4. **Verify after each step.** Run tests and type checks; confirm the import graph still respects documented boundaries; confirm public inputs and outputs are unchanged.

CAUTION: a large architectural change often needs a plan before code moves. If `deferred_to_plan` is non-empty, recommend running the planning skill before proceeding with those items.

Boundary note: dependency upgrades, test creation, and UI redesign are out of scope for this action.

## Test

All existing tests pass after each applied step; type checks exit zero; the import graph has no new boundary violations; each entry in `changes_applied` maps to a concrete edit in the diff; `deferred_to_plan` is populated for any structural move not safe to execute atomically.
