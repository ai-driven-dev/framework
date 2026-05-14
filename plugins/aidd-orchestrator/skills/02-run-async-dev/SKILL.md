---
name: aidd-orchestrator:02:run-async-dev
description: Runs one async development pipeline cycle: polls issues labeled with the `to-implement` label (or its mention equivalent), resolves dependencies, locks the issue with `claude/working`, delegates implementation to whichever SDLC capability is loaded at runtime, verifies the outcome against the real state of git and the VCS host, and writes a `run-result.json` artifact for the workflow's post-job to finalize lifecycle effects. Use when a fresh issue is labeled or mentioned for implementation, or when the user says "run async dev", "implement ready issues", "process the async queue". Do NOT use for setup or for handling change-request review comment loops; other skills in this plugin cover those.
---

# Run

Executes one orchestration cycle on a fresh issue. Reads ready issues, resolves blockers, acquires the lock label, hands the implementation to the active SDLC orchestration capability, observes the resulting git and VCS state, and emits a `run-result.json` summary the workflow's post-job consumes.

## Available actions

| #   | Action            | Role                                                                            | Input            |
| --- | ----------------- | ------------------------------------------------------------------------------- | ---------------- |
| 01  | `poll-ready`      | List candidate issues by `to-implement` label or mention                        | repo + config    |
| 02  | `resolve-deps`    | Filter out blocked issues via dependency chain                                  | candidate issues |
| 03  | `acquire-lock`    | Swap `to-implement` -> `claude/working`                                         | target issue     |
| 04  | `check-sdlc`      | Discover an SDLC orchestration capability by description                        | runtime context  |
| 05  | `delegate-sdlc`   | Invoke the discovered SDLC, then verify outcome by observing git and the VCS    | locked issue     |
| 06  | `write-audit`     | Emit `run-result.json` for the workflow post-job to consume                     | delegate output  |

## Default flow

Sequential: `01 -> 02 -> 03 -> 04 -> 05 -> 06`. Action 03 runs once per selected issue. If no issue passes 02, the skill stops cleanly without locking.

## Lifecycle labels

| Phase            | Label after action                  | Posed by |
| ---------------- | ----------------------------------- | -------- |
| Trigger received | `to-implement`                      | Human |
| Lock acquired    | `claude/working`                    | This skill (action 03) |
| Change request opened | `claude/awaiting-review`       | Workflow post-job (reads run-result.json) |
| Failure          | `claude/blocked` + comment          | Workflow post-job |

## Transversal rules

- Read `.claude/aidd-orchestrator.json` first; abort with a clear message if absent (refer the user to the setup skill of this plugin).
- Acquire the lock in action 03. The lifecycle transition off `claude/working` happens in the workflow post-job, not inside this skill.
- The SDLC is a black box. The orchestrator never parses the SDLC's return text. Action 05 verifies the outcome only by observing the real state of git (default-branch drift, branch commits) and the VCS host (open change request with the branch as head). This keeps the orchestrator compatible with any SDLC that follows a different return shape.
- The delegation prompt composed in action 05 contains a single free-text `request` plus human comments. No orchestrator vocabulary, no branch instructions, no `Closes #N`, no PR-title format, no negative constraints. The SDLC must run identically when called manually by a human.
- Never auto-merge. The pipeline ends at change-request creation.
- Apply `tool_allowlist` from config via the plugin `PreToolUse` hook when hooks are wired.
- Action 06 writes `run-result.json` and exits. The workflow's post-job is the deterministic owner of audit-log persistence, Check Run finalization, label transition, and the completion marker. Do NOT attempt those side effects inside the Claude skill.

## External data

- `aidd_docs/async-runs/` -- run history directory written by the workflow post-job, shared with this plugin's review skill
- `.claude/aidd-orchestrator.json` -- runtime config produced by this plugin's setup skill
- `$RUNNER_TEMP/run-result.json` -- single hand-off artifact between this skill and the workflow post-job
