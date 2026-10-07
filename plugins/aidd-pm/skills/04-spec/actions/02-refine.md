# 02 - Refine

Rewrite an existing spec in place to address review findings.

## Input

The path to the current spec, and the findings to address, a list or free text.

## Output

The refined spec at the same path, or no write.

## Process

1. **Load.** Read the spec and the findings.
2. **Map.** Pair each finding with the section it touches.
3. **Rewrite.** Apply each finding in place. Leave every other section as it is.
4. **Gaps.** Drop a resolved entry, narrow a half-answered one, list the rest per [tbd-marker.md](../references/tbd-marker.md).
5. **Check.** Every required section present, then overwrite the spec.
6. **Verify.** Report each change as `before -> after`, with the result.

## Test

| Case | Pass |
| --- | --- |
| The action completes | the spec is still at its path, with every section [spec-validator.yml](../assets/spec-validator.yml) requires |
| A finding is resolved | the spec changed at the section it names |
| A finding resolves a gap | its entry is gone, and the section is empty when it was the last |
| A finding cannot be resolved | it is listed once, in the open questions section only |
| A write happened | the result reports the stable identity, `before -> after` fields, and verification result |
| No write happened | the result states that no persisted change occurred |
