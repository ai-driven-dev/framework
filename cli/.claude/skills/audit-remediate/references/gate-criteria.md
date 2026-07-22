# Gate Criteria

A gate PASSES when all of the following are true simultaneously. A single failure collapses
the gate to FAIL — no partial passes.

## Required conditions

| Condition                          | Command                         | Required outcome                           |
| ---------------------------------- | ------------------------------- | ------------------------------------------ |
| TypeScript compilation             | `pnpm typecheck`                | Exit code 0                                |
| Test suite                         | `pnpm test`                     | Exit code 0; count >= baseline             |
| Build                              | `pnpm build`                    | Exit code 0                                |
| Traceability                       | (manual inspection)             | Every changed file has a logged fix entry  |

## Baseline comparison

The baseline is the state captured in action 01 (before any file was touched):

- **Test count**: `pnpm test` at gate time must report a test count >= the baseline count.
  New tests added during remediation are fine. Missing tests are not.
- **Build size**: the build output size must stay within the project's configured budget
  (typically displayed as "within budget" by the build tool). A size regression is not a gate
  failure by itself, but record it in the log if it occurs.

## Traceability requirement

After action 03, list all files modified with `git diff --name-only`. Each file in that list
must have a corresponding entry in the action 03 log. Any file without a logged fix entry
represents an unintentional change — restore it with `git restore <file>` before running the gate.

## Clean-run gate (no violations found)

When action 02 produced a confirmed-clean verdict and action 03 was skipped, the gate still runs:
- `pnpm typecheck` exits 0
- `pnpm test` exits 0 with count >= baseline
- `pnpm build` exits 0
- `git diff --name-only` in the target layer is empty (no files changed)

## Escalation

If the gate fails and the root cause is unclear after one retry, append a blockers entry to
the task tracking file and stop. Do not continue iterating blindly.
