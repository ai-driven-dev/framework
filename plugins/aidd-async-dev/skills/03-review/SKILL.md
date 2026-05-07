---
name: aidd-async-dev:03:review
description: Handles the post-PR review-fix loop for runs created by this plugin's run skill. Collects review comments, decides whether to keep iterating, delegates fixes to whichever SDLC capability is loaded at runtime, and finalizes when stop conditions trigger. Use when the user (or a webhook / cron) says "handle review comments", "iterate on PR <n>", "address review feedback automatically", or invokes this skill on a specific PR. Do NOT use for the initial implementation or for setup; other skills in this plugin cover those.
---

# Review

Closes the loop after a PR is opened by this plugin's run skill. Detects when to keep auto-fixing and when to hand off to a human.

## Available actions

| #   | Action              | Role                                                           | Input        |
| --- | ------------------- | -------------------------------------------------------------- | ------------ |
| 01  | `collect-comments`  | Fetch PR review comments since the last iteration              | PR number    |
| 02  | `detect-stop`       | Decide stop vs continue (max-N, label, human)                  | comments + state |
| 03  | `fix-iteration`     | Delegate fixes to the discovered SDLC capability               | comments     |
| 04  | `finalize`          | Update audit record and stop the loop cleanly                  | iteration log |

## Default flow

Loop: `01 -> 02`. If `02` says continue, run `03` then jump back to `01`. If `02` says stop, run `04` once and exit.

## Transversal rules

- Read `.claude/aidd-async-dev.json` for `max_iterations` and label names.
- Track iteration count in the audit record produced by this plugin's run skill. Resume the same `run_id`, do not create a new one.
- Discover the SDLC capability the same way the run skill does: search loaded skills by description. Never hardcode a skill name.
- Never auto-merge. The loop only adds commits to the existing PR branch.
- See `references/stop-conditions.md` for the precise stop logic.

## References (documents to read)

- `references/stop-conditions.md` -- ordered stop conditions and human detection heuristics

## External data (cross-skill pointers per R7)

- `aidd_docs/async-runs/` -- run history (this skill appends iteration entries to existing records)
- `.claude/aidd-async-dev.json` -- runtime config produced by this plugin's setup skill
