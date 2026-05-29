# 05 - Verify or Rollback

Commit the changes if the gate passed. Roll back to the baseline state if the gate failed.
In either case, append a log entry to the task tracking file.

## Inputs

- `gate-result` (required) - PASS or FAIL from action 04
- `target-layer-path` (required) - the directory that was edited
- `phase-id` (required) - the phase identifier (e.g. "P2", "P3", "P4")
- `layer-skill` (required) - the layer skill used

## Outputs

- On PASS: a commit on the current branch, log entry in the tracking file
- On FAIL: a clean working tree (all edits reverted), log entry with failure reason

## Process — PASS path

1. Stage all changes in `target-layer-path`: `git add <target-layer-path>`.
2. Commit with a conventional message:
   `refactor(domain): <phase-id> audit-remediate <target-layer-path> via <layer-skill>`
3. Log entry format:
   "[PASS] \<phase-id\> \<target-layer-path\> — \<layer-skill\> drove \<N\> fix(es). Tests: \<count\>. Build: OK."

## Process — FAIL path

1. Restore all changes in `target-layer-path`: `git restore <target-layer-path>`.
2. Confirm working tree is clean: `git status <target-layer-path>` shows no modifications.
3. Log entry format:
   "[FAIL] \<phase-id\> \<target-layer-path\> — gate failed: \<reason\>. Working tree restored. Next attempt: \<different-approach\>."
4. Do not increment the phase checkbox. Retry with a different approach.

## Confirmed-clean path (no violations found in action 02)

If action 02 produced a clean verdict and action 03 was skipped:
1. No commit needed (no files changed).
2. Log entry format:
   "[CLEAN] \<phase-id\> \<target-layer-path\> — \<layer-skill\> confirmed clean (0 violations). Tests: \<count\>. Build: OK."

## Test

After PASS: `git log --oneline -1` shows the new commit. After FAIL: `git status` shows a
clean tree for the target layer path.
