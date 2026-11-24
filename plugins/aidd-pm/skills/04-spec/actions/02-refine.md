# 02 - Refine

Rewrite an existing spec in place to address review findings.

## Input

The spec's path, and the findings.

## Process

1. Pair each finding with the section it touches.
2. Apply each finding in its section, and leave every other section as it is.
3. Update each gap per [tbd-marker.md](../references/tbd-marker.md):
   - Resolved by a finding: drop it.
   - Half answered: narrow it.
   - Still open, or a finding that cannot be resolved: list it.
4. Overwrite the spec, run [validate-spec.cjs](../scripts/validate-spec.cjs) on it, fix, repeat until it passes.
5. Report its path and each change as `before -> after`.
   - Nothing changed: say nothing was written.

## Output

The refined spec at its path, or no write.
