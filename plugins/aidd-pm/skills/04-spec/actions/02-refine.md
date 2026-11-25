# 02 - Refine

Update an existing spec in place from changes.

## Input

The spec's path, and the changes to apply.

## Process

1. Read the spec.
2. Pair each change with the section it touches.
3. Apply each change in its section, and leave every other section as it is.
4. Update each gap per [spec-content.md](../references/spec-content.md):
   - Resolved by a change: drop it.
   - Half answered: narrow it.
   - Still open, or a change that cannot be resolved: list it.
5. Overwrite the spec, run [validate-spec.cjs](../scripts/validate-spec.cjs) on it, fix, repeat until it passes.
6. Answer by filling [refine-answer.md](../assets/refine-answer.md).
   - Nothing changed: say nothing was written.

## Output

The refined spec at its path, or no write.
