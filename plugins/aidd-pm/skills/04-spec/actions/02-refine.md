# 02 - Refine

Rewrite an existing spec in place to address review findings.

## Input

The spec's path, and the findings.

## Output

The refined spec at the same path, or no write.

## Process

1. **Map.** Pair each finding with the section it touches.
2. **Rewrite.** Apply each finding in place. Leave every other section as it is.
3. **Gaps.** Drop a resolved entry, narrow a half-answered one, list the rest per [tbd-marker.md](../references/tbd-marker.md). `None` when none remains.
4. **Check.** No required section missing, then overwrite the spec.
5. **Verify.** Report each change as `before -> after`, with the result.

## Test

| Case | Pass |
| --- | --- |
| The action completes | the spec is still at its path, with every section [spec-template.md](../assets/spec-template.md) requires |
| A finding is resolved | the spec changed at the section it names |
| A finding resolves a gap | its entry is gone, and the section reads `None` when it was the last |
| A finding cannot be resolved | it is listed once, in the open questions section only |
| A write happened | the result reports the path and each `before -> after` |
| No write | the result says nothing was written |
