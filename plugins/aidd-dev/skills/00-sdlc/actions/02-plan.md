# 02 - Plan

Turn the spec, or the raw request when spec was skipped, into a validated plan file. Mandatory.

## Input

The spec path from `01` (null when skipped), the objective and acceptance criteria from `01`, the raw `$ARGUMENTS` (needed when there is no spec), and the repo root.

## Output

The plan path and its phase paths, plus the decisions the planner made and any it could not make alone.

## Process

1. **Spawn.** Spawn the `planner` agent with the inputs above. Brief it to run `aidd-dev:01-plan` end to end, and never to inline a raw ticket or spec as the plan body.
2. **Read.** Capture what the planner returns.
3. **Return.** Surface the plan path, the phase paths, and the decisions.

## Test

- The plan file exists, its frontmatter carries `objective` and `status: pending`, and the plan's objective matches the spec's (or the request when spec was skipped).
