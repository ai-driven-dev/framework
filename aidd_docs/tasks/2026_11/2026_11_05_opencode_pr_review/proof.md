# OpenCode review after Alex's GitHub review

A five-minute timer on Alex's existing OpenCode server scans submitted reviews
for `ai-driven-dev/framework`. It reviews changed files with `05-review` and
`openai/gpt-6.1-terra#medium`, then posts the report on the PR. Per-file
fingerprints live on the server so later submissions skip unchanged files.
Forks are read as data.

The timer starts from an explicit activation time, runs serially, and retries
transient errors with bounded backoff. Incomplete reviews checkpoint only files
whose inputs were read and reported. Binary or unsupported files are named as
not reviewed. Each file is reviewed in one session; files whose diff and PR
context exceed the 120,000-byte session budget are named as not reviewed. The
PR title and description are capped at 60,000 bytes, with truncation reported.
Diffs and Git file modes come directly
from Git without checkout. Each batch has its own comment; a persistent draft
allows publication retries without repeating the model call or comment. Losing
the state volume loses the review history and may cause files to be reviewed again.

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
- A real Git diff on PR #1150 returned all 17 files, including modes, without
  executing PR content.
- The installed timer detected a submitted review on PR #1150 and published a
  report. A second submission on the same commit advanced its checkpoint without
  creating another OpenCode session or comment. The reported file-mode gap is
  covered by the Git mode checks above. A subsequent submission reviewed seven
  changed files and skipped ten unchanged files.
