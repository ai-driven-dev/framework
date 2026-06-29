# 02 - Plan

Turn the spec, or the raw request when spec was skipped, into a validated plan file. Mandatory.

## Input

The spec path from `01` (null when skipped), the objective and acceptance criteria from `01`, the raw arguments (needed when there is no spec), and the repo root.

## Output

The plan path and its phase paths, plus the decisions you made and any you could not make alone.

## Process

1. **Author.** Run `aidd-dev:01-plan` end to end in your own context. You own the plan: it is the contract the executor may not rewrite, so you write it, never a worker. Never inline a raw ticket or spec as the plan body.
2. **Capture.** Read the plan path, the phase paths, and the decisions the plan records.
3. **Return.** Surface them for the next step.

## Test

- The plan file exists, its frontmatter carries `objective` and `status: pending`, and the plan's objective matches the spec's (or the request when spec was skipped).
