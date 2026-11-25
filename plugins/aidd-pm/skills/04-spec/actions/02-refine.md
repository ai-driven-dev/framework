# 02 - Refine

Update an existing spec in place from findings.

## Input

The spec's path, and the findings: review findings or answers to its open questions.

## Process

1. Read the spec.
2. Pair each finding with the section it touches.
3. Apply each finding in its section, and leave every other section as it is.
4. Update each gap per [spec-content.md](../references/spec-content.md):
   - Resolved by a finding: drop it.
   - Half answered: narrow it.
   - Still open, or a finding that cannot be resolved: list it.
5. Overwrite the spec, run [validate-spec.cjs](../scripts/validate-spec.cjs) on it, fix, repeat until it passes.
6. Answer with its path and each changed line, as `- old` then `+ new`.
   - Another section breaking spec-content.md: name it, unchanged.
   - Nothing changed: say nothing was written.

## Output

The refined spec at its path, or no write.
