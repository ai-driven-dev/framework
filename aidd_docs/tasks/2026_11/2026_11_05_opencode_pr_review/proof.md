# OpenCode review after Alex's GitHub review

The earlier prototype used a five-minute timer on Alex's OpenCode server. It
posted real reports on PR #1150, including one run that reviewed seven changed
files and skipped ten unchanged files. Its checkpoint lived on the server and
its OpenCode permission checks were not an operating-system sandbox.

The replacement uses a scheduled GitHub workflow, a dedicated runner and a
separate OpenCode reviewer session. GitHub comments hold the completed file
fingerprints. A private runner volume retains completed model output across a
temporary GitHub publication failure. The workflow reads only reviews submitted
by Alex after the configured activation time; binary and oversized diffs are
explicitly reported as not reviewed. OpenCode receives the PR title and
description as untrusted context and must load `05-review`, read its actions
and read the supplied diffs before a file is checkpointed.

## Local verification

- `bash scripts/pr-review/test-review.sh` exercises discovery, idempotence,
  unchanged and changed files, retries, out-of-order submissions, forks,
  unsupported diffs, and untrusted comment markers.
- `bash scripts/pr-review/test-model.sh` checks that missing context, skills,
  trace coverage, restrictions, or complete reads cannot produce a checkpoint.
- A real local run with `openai/gpt-6.1-terra#medium` in the isolated runner
  found the seeded `average([])` regression and confirmed `average.py` in the
  validated coverage. A separate UID prevented the reviewer from reading a
  synthetic GitHub token or writing the snapshot.
- With Codex OAuth, a simulated publication failure resumed from the saved
  draft without another model call; an unchanged file was skipped.
- A persistent runner reconnected after a graceful Docker stop and start with
  `RUNNER_MANUALLY_TRAP_SIG=1`. Registration files are restricted to mode 600.
- GitHub Actions run 41999398223 used the real workflow steps and app token on
  a temporary restricted runner. A future activation date prevented reviews
  and publication; the temporary branch trigger and runner were removed.

The new scheduled workflow is not active until it exists on the repository's
default branch and its dedicated runner and activation timestamp are configured.
The old timer must be stopped during the cutover to prevent duplicate reviews;
it remains the active implementation until that cutover.
