# 02 - Assert Architecture

Verify that the codebase (or a specific scope) conforms to the documented architecture: C4 diagrams, ADRs, and project tree structure.

## Inputs

```yaml
scope: <module, service, or layer name>   # optional; defaults to the entire project
```

## Outputs

```yaml
report:
  macro:
    - { severity: critical|warning, file: <path>, constraint: <text>, fix: <one-line> }
  micro:
    - { severity: critical|warning, file: <path>, constraint: <text>, fix: <one-line> }
totals:
  violations_total: <int>
  critical: <int>
  warning: <int>
```

## Process

1. **Load architecture context.**
   - Remember the architecture diagrams from `aidd_docs/memory/architecture.md`.
   - Read micro diagrams from `aidd_docs/memory/internal/` when the scope targets a specific module.
   - Read ADRs from `aidd_docs/internal/decisions/`.
   - Extract the expected project tree structure from the diagrams.
2. **Verify macro architecture (service boundaries).**
   - Compare actual code structure against the documented tree.
   - Flag files outside expected boundaries.
   - Flag direct imports between independent services.
3. **Verify micro architecture (internal layers).** For each module in scope:
   - Check that import directions match layer constraints.
   - Confirm the domain layer has zero external imports.
   - Confirm the application layer depends only on the domain via ports.
   - Detect circular dependencies between modules.
   - Verify the expected patterns (use cases have ports, adapters implement interfaces).
4. **Build the violation report.** Each entry carries severity (`critical | warning`), file path, the constraint violated, and a one-line suggested fix. Group entries macro vs micro.
5. **Boundary.** Do not fix violations - only report them. If no scope is provided, check the entire project.
6. **Summarize.** Total violations, critical count, recommended next actions.

## Test

If conformity holds: `violations_total == 0` and the report explicitly states "no violations" in both macro and micro sections. If violations exist: every report entry has a real file path that exists on disk, a referenced constraint that appears in one of the loaded architecture sources, and a non-empty `fix` field.
