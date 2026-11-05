# OpenCode review after Alex's GitHub review

A five-minute timer on Alex's existing OpenCode server scans submitted reviews
for `ai-driven-dev/framework`. It reviews changed files with `05-review` and
`openai/gpt-6.1-terra#medium`, then posts the report on the PR. Per-file
fingerprints live on the server so later submissions skip unchanged files.
Forks are read as data.

The timer starts from an explicit activation time, runs serially, and retries
transient errors with bounded backoff. Incomplete reviews checkpoint only files
whose inputs were read and reported. Binary or unsupported files are named as
not reviewed. Each file is reviewed in one session; a diff larger than
120,000 bytes is named as not reviewed. Missing text patches are reconstructed
from Git without checkout.
Git file modes are included in the review input and fingerprints.
Reports too large for one comment are split; a persistent draft allows retries
without publishing the same part twice. Losing the state volume loses the review
history and may cause files to be reviewed again.

OpenCode runs outside any Git worktree with a read-only review agent and no
GitHub token in its environment. These OpenCode permissions are not an OS
sandbox. The installed CLI is pinned to 2.2.5, the version checked on the
server. A server version change pauses reviews until it is revalidated.

## Verification

- `node --test scripts/__tests__/opencode-review-{ci,discover,state,git,snapshot}.test.js`
  covers selection, retries, checkpoints, stale heads, partial coverage,
  long lines, and Git recovery.
- A real OpenCode run in the server container loaded `05-review`, read its
  actions and a PR diff, and returned a report accepted by the coverage
  verifier. An external sentinel read was denied; another global skill was
  unavailable. OpenCode's existing OAuth login was used without copying tokens.
- A real Git recovery on PR #1145 retained a 2,276-byte line omitted by the
  former size limit. No PR content was executed.
- The installed timer detected a submitted review on PR #1150 and published a
  report. A second submission on the same commit advanced its checkpoint without
  creating another OpenCode session or comment. The reported file-mode gap is
  covered by the Git mode checks above. A subsequent submission reviewed seven
  changed files and skipped ten unchanged files.
