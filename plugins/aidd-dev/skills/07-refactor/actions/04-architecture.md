# 04 - Architecture

Enforce documented boundaries, fix wrong-direction dependencies, and decouple structural problems, in small verifiable steps that preserve observable behavior where possible.

## Input

An optional scope, a directory or file glob, defaulting to the entire codebase. Optionally a pushed audit report, a path under `aidd_docs/tasks/audits/` or pasted findings.

## Output

The changes applied (file, one-line summary, severity), a verification summary, and a deferred list of structural moves too large to execute atomically, each flagged as needing a plan first.

## Process

1. **Source.** When an audit report is pushed, take its architecture-axis findings as the fix list and skip the scan. Otherwise scan the scope against documented boundaries (C4 diagrams or ADRs in `aidd_docs/memory/`), identify wrong-direction dependencies, god-modules, missing layer abstractions, and violated isolation contracts, and rate each with the shared severity scale.
2. **Triage.** Separate changes safe to apply atomically now from those needing broad coordinated moves. Defer the latter, flagged as needing a plan first.
3. **Apply.** Make the safe changes in small, independently verifiable steps:
   - Extract or restore layers (separate domain, infrastructure, and presentation concerns).
   - Fix wrong-direction dependencies by introducing an interface or inversion point, never letting infrastructure reach into the domain.
   - Decouple god-modules by splitting responsibilities along natural seams.
   - Enforce documented boundaries by moving code, adjusting exports, and updating internal references.
4. **Verify.** After each step run tests and type checks, confirm the import graph still respects documented boundaries, and confirm public inputs and outputs are unchanged.

When the deferred list is non-empty, recommend planning those structural moves before any code moves.

## Test

- All existing tests pass after each applied step and type checks exit zero.
- The import graph has no new boundary violations.
- Each change applied maps to a concrete edit in the diff.
- Any structural move not safe to execute atomically is in the deferred list.
