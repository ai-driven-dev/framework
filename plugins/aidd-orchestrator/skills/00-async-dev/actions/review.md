# Review

Closes the loop after a PR is opened by the run flow. Detects when to keep auto-fixing and when to hand off to a human. Idempotent on re-runs.

| #   | Action               | Role                                                                                       |
| --- | -------------------- | ------------------------------------------------------------------------------------------ |
| 01  | `collect-comments`   | Read all PR + linked-issue comments newer than the last bot activity                       |
| 02  | `detect-stop`        | Decide stop vs continue using `references/review/stop-conditions.md`                       |
| 03  | `fix-iteration`      | Delegate fixes to the SDLC capability; reply to each addressed comment                     |
| 04  | `finalize`           | Resolve threads, post the structured summary, set `claude/awaiting-review` or `blocked`    |

Action files, read in the order above:

- `actions/review/01-collect-comments.md`
- `actions/review/02-detect-stop.md`
- `actions/review/03-fix-iteration.md`
- `actions/review/04-finalize.md`

Default flow: `01 → 02 → (03 → 01 loop if continue) → 04`. Stop conditions in `references/review/stop-conditions.md`.
