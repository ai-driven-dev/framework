---
name: aidd-orchestrator:03:review
description: Handles the post-PR review-fix loop for runs created by this plugin's run skill. Triggered when the human labels the linked issue with `to-review` (or comments `@claude /review` on the PR). Collects review comments, decides whether to keep iterating, delegates fixes to whichever SDLC capability is loaded at runtime, replies to each addressed comment, resolves the threads, and posts a structured summary when stop conditions trigger. Use when the user (or a webhook / cron) says "handle review comments", "iterate on PR <n>", "address review feedback automatically", or invokes this skill on a specific PR. Do NOT use for the initial implementation or for setup; other skills in this plugin cover those.
---

# Review

Closes the loop after a PR is opened by this plugin's run skill. Detects when to keep auto-fixing and when to hand off to a human.

## Available actions

| #   | Action              | Role                                                                                | Input        |
| --- | ------------------- | ----------------------------------------------------------------------------------- | ------------ |
| 01  | `collect-comments`  | Add `eyes` reaction, transition issue to `claude/working`, fetch comments           | PR number    |
| 02  | `detect-stop`       | Decide stop vs continue (max-N, blocked label, human reviewer)                      | comments + state |
| 03  | `fix-iteration`     | Delegate fixes, push commit, reply per comment, resolve threads                     | comments     |
| 04  | `finalize`          | Post structured summary, set final reaction, transition issue to awaiting-review or blocked | iteration log |

## Default flow

Loop: `01 -> 02`. If `02` says continue, run `03` then jump back to `01`. If `02` says stop, run `04` once and exit.

## Lifecycle labels

| Phase            | Label after action                  | Posed by |
| ---------------- | ----------------------------------- | -------- |
| Trigger received | `to-review` (or `claude/awaiting-review` was already there) | Human |
| Lock acquired    | `claude/working`                    | This skill (action 01) |
| Stop: human OK   | `claude/awaiting-review`            | This skill (action 04) |
| Stop: max iter   | `claude/awaiting-review`            | This skill (action 04) |
| Stop: blocked    | `claude/blocked`                    | This skill (action 04) |

## Transversal rules

- Read `.claude/aidd-orchestrator.json` for `max_iterations` and label names.
- Track iteration count in the audit record produced by this plugin's run skill. Resume the same `run_id`, do not create a new one.
- Discover the SDLC capability the same way the run skill does: search loaded skills by description. Never hardcode a skill name.
- Never auto-merge. The loop only adds commits to the existing PR branch.
- **Always acknowledge the trigger**: action `01` adds an `eyes` reaction; action `04` swaps it to `+1` / `confused` / `-1` based on stop reason.
- **Always respond per comment**: every addressed inline review comment receives a threaded reply with the fix summary and the corresponding commit link, then its review thread is resolved via the GraphQL `resolveReviewThread` mutation. No silent fix.
- **Always post a summary**: action `04` posts exactly one structured PR comment (template defined in `actions/skills/04-finalize.md`). Posted even when no fix iteration ran.
- See `references/stop-conditions.md` for the precise stop logic.

## References

- `references/stop-conditions.md` -- ordered stop conditions and human detection heuristics

## External data

- `aidd_docs/async-runs/` -- run history (this skill appends iteration entries to existing records)
- `.claude/aidd-orchestrator.json` -- runtime config produced by this plugin's setup skill
