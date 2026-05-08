---
name: aidd-orchestrator:02:run
description: Runs one async development pipeline cycle: polls issues labeled with the `to-implement` label (or its mention equivalent), resolves dependencies, locks the issue with `claude/working`, delegates implementation to whichever SDLC capability is loaded at runtime, opens a PR, and ends with the issue marked `claude/awaiting-review`. Use when a fresh issue is labeled or mentioned for implementation, or when the user says "run async dev", "implement ready issues", "process the async queue". Do NOT use for setup or for handling PR review comment loops; other skills in this plugin cover those.
---

# Run

Executes one orchestration cycle on a fresh issue. Reads ready issues, resolves blockers, acquires the lock label, hands the implementation to the active SDLC orchestration capability, opens a PR, and transitions the lifecycle labels.

## Available actions

| #   | Action            | Role                                                         | Input            |
| --- | ----------------- | ------------------------------------------------------------ | ---------------- |
| 01  | `poll-ready`      | List candidate issues by `to-implement` label or mention     | repo + config    |
| 02  | `resolve-deps`    | Filter out blocked issues via dependency chain               | candidate issues |
| 03  | `acquire-lock`    | Swap `to-implement` -> `claude/working`                      | target issue     |
| 04  | `check-sdlc`      | Discover an active SDLC orchestration capability             | runtime context  |
| 05  | `delegate-sdlc`   | Invoke the discovered SDLC capability with issue context     | locked issue     |
| 06  | `write-audit`     | Persist run record, Check Run, transition to `claude/awaiting-review` | run result |

## Default flow

Sequential: `01 -> 02 -> 03 -> 04 -> 05 -> 06`. Action 03 runs once per selected issue. If no issue passes 02, the skill stops cleanly without locking.

## Lifecycle labels

| Phase            | Label after action                  | Posed by |
| ---------------- | ----------------------------------- | -------- |
| Trigger received | `to-implement`                      | Human    |
| Lock acquired    | `claude/working`                    | This skill (action 03) |
| PR opened        | `claude/awaiting-review`            | This skill (action 06) |
| Failure          | `claude/blocked` + comment          | This skill (action 06) |

## Transversal rules

- Read `.claude/aidd-orchestrator.json` first; abort with a clear message if absent (refer the user to the setup skill of this plugin).
- Acquire the lock before delegating. Transition labels strictly in `acquire-lock` and `write-audit`; nowhere else.
- On any failure between 03 and 06, attach the error to the audit record and the issue as a comment, replace `claude/working` with `claude/blocked`, and stop.
- Never auto-merge. The pipeline ends at PR creation.
- Apply `tool_allowlist` from config via the plugin `PreToolUse` hook when hooks are wired.

## External data

- `aidd_docs/async-runs/` -- run history directory shared with this plugin's review skill
- `.claude/aidd-orchestrator.json` -- runtime config produced by this plugin's setup skill
