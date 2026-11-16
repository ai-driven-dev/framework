# 02 -- Detect Stop

Route the reconciled state using the shared follow-up contract.

## Input

`collect_output` from `01-collect-comments`, configuration, current issue labels
and the user's authorization. No independent iteration counter is accepted.

## Output

- `decision`: `continue`, `wait` or `stop`.
- `followup_state`: `reconciling`, `watching`, `handed-to-parent`, `complete`
  or `blocked`.
- `reason`: `blocked_label`, `max_iterations`, `human_reviewer`, `no_comments`
  or a specific recovery/authorization/host failure.
- `should_finalize`: true only for a terminal stop, never for an external wait.

## Process

Apply [stop conditions](../../references/review/stop-conditions.md) in order:

1. Honor an explicit stop/blocked label or a human direction needing a decision.
   New human feedback within the authorized scope is assessed normally; its
   timestamp or author type alone does not force a manual restart.
2. Block mutations on incomplete recovery, missing authorization, another owner
   or incomplete collection. Return the exact reason, not `no_comments`.
3. Recover an in-flight batch before proposing another. Reconcile already
   acknowledged effects without repeating them. A reserved batch is not a new
   iteration on every invocation; completed tests/pushes/replies stay completed.
4. If actionable feedback remains, continue only with an authorized unfinished
   batch or capacity for a new one under the shared limit. Otherwise stop with
   `max_iterations`, preserving every unresolved finding. This applies equally
   to human and bot feedback and failed checks.
5. If no corrective work is available but a result of the current SHA is pending,
   return `wait`. The top-level owner prepares any local continuation artifacts,
   then uses the shared follow-up action to watch and end the turn on T3. A
   delegated child returns `handed-to-parent` and never watches. A host without
   a persistent wake mechanism reports `blocked`; do not poll or falsely finish.
6. Only when every expected result of the current SHA is terminal and assessed,
   and no feedback remains, return `stop`, `complete`, `no_comments`. This also
   applies after the second batch: examine its results before handing back.

## Test

- Only an unaddressed Codex/Osly comment: `continue` with available budget.
- Only red CI: assess the failure; never close as `no_comments`.
- Green CI with a late reviewer pending: `wait`, not terminal success.
- Two completed batches plus a new finding: `stop / max_iterations`.
- Duplicate wake after batch 2 while its checks run: `wait`, count unchanged.
- Unknown count or owner: `blocked`, with no corrective mutation.
