---
name: aidd-async-dev:02:run
description: Runs one async development pipeline cycle: polls ready GitHub issues, resolves dependencies, locks the issue, delegates implementation to whichever SDLC capability is loaded at runtime, then writes audit log and SIEM webhook. Use when the user (or CI / cron / @claude mention / project board move) says "run async dev", "implement ready issues", "process the async queue", or invokes this skill on a specific issue. Do NOT use for setup or for handling PR review comment loops; other skills in this plugin cover those.
---

# Run

Executes one orchestration cycle. Reads ready issues, resolves blockers, acquires a per-issue lock, hands the implementation to the active SDLC orchestration capability discovered in the runtime, and records audit + observability artifacts.

## Available actions

| #   | Action            | Role                                                         | Input            |
| --- | ----------------- | ------------------------------------------------------------ | ---------------- |
| 01  | `poll-ready`      | List ready issues by label, project column, or mention       | repo + config    |
| 02  | `resolve-deps`    | Filter out blocked issues via dependency chain               | candidate issues |
| 03  | `acquire-lock`    | Add `ai:running` label to dedupe parallel runs               | target issue     |
| 04  | `check-sdlc`      | Discover an active SDLC orchestration capability             | runtime context  |
| 05  | `delegate-sdlc`   | Invoke the discovered SDLC capability with issue context     | locked issue     |
| 06  | `write-audit`     | Persist run record to `aidd_docs/async-runs/` and Check Run  | run result       |
| 07  | `emit-webhook`    | POST run record to SIEM webhook if configured                | run record       |

## Default flow

Sequential: `01 -> 02 -> 03 -> 04 -> 05 -> 06 -> 07`. Action 03 runs once per selected issue. If no issue passes 02, the skill stops cleanly without locking.

## Transversal rules

- Read `.claude/aidd-async-dev.json` first; abort with a clear message if absent (refer the user to the setup skill of this plugin).
- Acquire the lock before delegating. Release the lock by removing `ai:running` only after `06-write-audit` succeeds, regardless of pipeline outcome.
- On any failure between 03 and 06, attach the error to the audit record and the issue as a comment; keep `ai:running` so a human can investigate.
- Never auto-merge. The pipeline ends at PR creation.
- Apply `tool_allowlist` from config via the plugin `PreToolUse` hook when hooks are wired.

## External data (cross-skill pointers per R7)

- `aidd_docs/async-runs/` -- run history directory shared with this plugin's review skill
- `.claude/aidd-async-dev.json` -- runtime config produced by this plugin's setup skill
