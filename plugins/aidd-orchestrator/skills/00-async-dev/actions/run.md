# Run

Executes one orchestration cycle on a fresh issue. Reads ready issues, resolves blockers, acquires the lock label, hands the implementation to the active SDLC orchestration capability, observes the resulting git and VCS state, and emits a `run-result.json` summary the workflow's post-job consumes.

| #   | Action            | Role                                                                                           |
| --- | ----------------- | ---------------------------------------------------------------------------------------------- |
| 01  | `poll-ready`      | Find the next issue with `to-implement`, no `claude/working`, no open closing PR               |
| 02  | `resolve-deps`    | Check linked issues / dependencies; abort if blocked                                           |
| 03  | `acquire-lock`    | Apply `claude/working` label; refuse if already held                                           |
| 04  | `check-sdlc`      | Verify an SDLC orchestration capability is loaded                                              |
| 05  | `delegate-sdlc`   | Hand the issue to the SDLC capability; observe outcome                                         |
| 06  | `write-audit`     | Emit `run-result.json` for the workflow's post-job                                             |

Action files, read in the order above:

- `actions/run/01-poll-ready.md`
- `actions/run/02-resolve-deps.md`
- `actions/run/03-acquire-lock.md`
- `actions/run/04-check-sdlc.md`
- `actions/run/05-delegate-sdlc.md`
- `actions/run/06-write-audit.md`

Default flow: `01 → 02 → 03 → 04 → 05 → 06`. One cycle per ready issue.
