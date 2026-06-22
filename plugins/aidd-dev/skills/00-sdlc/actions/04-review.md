# 04 - Review

Judge the completed work against an explicit validator and emit a ship-or-iterate verdict.

## Input

The working diff or paths produced by `03`, the validator (the plan path and acceptance criteria), and any related context the reviewer needs.

## Output

A `ship` or `iterate` verdict with the reviewed items, the findings, and the completion and quality scores. The plan reaches `status: reviewed` on ship, `status: in-progress` on iterate.

## Process

1. **Spawn.** Spawn the `reviewer` agent with the inputs above. Brief it to run `aidd-dev:05-review`, code and functional, and return its verdict.
2. **Map.** When every check passes, the verdict is `ship`. On any blocking finding, the verdict is `iterate`.
3. **Mark.** On `ship`, set the plan frontmatter `status: reviewed`. On `iterate`, set `status: in-progress` before looping back.
4. **Iterate.** On `iterate`, return the findings as the fix list for `03`.

## Test

- The verdict is `ship` or `iterate`, and the scores are integers between 0 and 100.
- The findings are non-empty on `iterate`.
- The plan frontmatter reads `status: reviewed` on ship, `status: in-progress` on iterate.
