# 03 - Finalize

Run the validation and mark the plan implemented once every phase is done.

## Input

A plan whose phases are all `status: done`, from `02-execute`.

## Output

The feature validated green with the plan frontmatter `status: implemented`.

## Process

1. **Verify.** Run the plan's validation commands and tests. Never format code, never run dev mode.
2. **Mark.** When every phase is done and validation passes, set plan `status: implemented`. Under the [commit rules](../SKILL.md#transversal-rules), hand off retained categories separately in phase order, then the plan status. Without authorization, leave changes uncommitted.

## Test

- The validation commands exit zero.
- The plan reads `status: implemented`; authorized commits include only due implementation changes and status.
