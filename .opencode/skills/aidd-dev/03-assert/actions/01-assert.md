# 01 - Assert

Iterate until a feature works as intended by running the project's coding assertions and fixing every failure.

## Inputs

```yaml
feature: <name or short description of the feature to assert>
```

## Outputs

```yaml
assertions_total: <int>
assertions_passing: <int>
iterations: <int>
fixes_applied:
  - { file: <path>, change: <one-line summary> }
```

## Process

1. **Enumerate assertions.** From the current context (project conventions and coding-assertions memory), list the assertions that apply to the feature.
2. **Iterate per assertion.** For each one:
   - Fix any issues preventing it from passing.
   - Re-run the assertion to confirm it passes.
3. **Full re-check.** Once every assertion has passed at least once, re-run all of them in one sweep to confirm none regressed.
4. **Boundary.** Do not stop until every assertion passes in the final sweep.

## Test

The final sweep reports `assertions_passing == assertions_total`; the recorded `fixes_applied` list cites real diffs (no empty or placeholder entries when fixes were claimed).
