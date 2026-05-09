# 09 -- Bootstrap Scheduling

Schedules `scripts/aidd-async-poll.sh` via a Claude Code-native path. No OS-level cron.

## Inputs

- `answers` (required) -- config object from `02-ask-config`
- `detection` (required) -- detection report from `01-detect-context`

## Outputs

```json
{
  "path": "desktop_task_pending",
  "interval_minutes": 5
}
```

`path` is `"desktop_task_pending"` (Desktop UI step pending), `"schedule_routine"` (cloud routine created), or `"manual_only"` (no schedule, user runs the script by hand).

## Depends on

- `04-generate-local-script`

## Process

1. Skip when `answers.mode == "remote"`.
2. Print the cadence options up front so the user can pick the path that matches the interval they want:

   | Path | Tool | Min interval | Runs when |
   | ---- | ---- | ------------ | --------- |
   | A. Desktop scheduled task (recommended for < 1h) | Claude Code Desktop UI | 1 minute | When the machine is awake |
   | B. `/schedule` cloud routine | Claude Code session | 1 hour | Always (server-side) |
   | C. Manual only | none | n/a | When the user runs `./scripts/aidd-async-poll.sh` |

3. Ask the user to pick A, B, or C. Default A.
4. Ask the desired interval (default `5` minutes for path A, `1` hour for path B, n/a for path C). Validate path B's interval is at least `60` minutes; reject lower values with a message pointing to path A.
5. Branch on the choice:
   - **Path A (Desktop)**: print a four-bullet checklist for the Desktop UI: open Scheduled tasks, set working directory to the repo root, set the cadence, paste the prompt `Run ./scripts/aidd-async-poll.sh and report what was processed.`. Set `path = "desktop_task_pending"`. The user finishes the UI step manually.
   - **Path B (cloud routine)**: invoke the runtime `/schedule` skill via the `Skill` tool with the cron expression and the prompt `Use skill aidd-orchestrator:02:run-async-dev on the next ready issue in <owner>/<repo>`. Capture the routine id. Set `path = "schedule_routine"`.
   - **Path C (manual)**: print the one-liner `./scripts/aidd-async-poll.sh` and a reminder that nothing runs until the user invokes it. Set `path = "manual_only"`.
6. Emit the structured result.

## Test

**Path A**: action prints a four-bullet checklist that includes the literal repo working directory and the literal prompt; returns `path = "desktop_task_pending"` and the chosen interval in minutes.

**Path B with interval = 30**: action rejects the input with a message pointing to path A and re-prompts. With interval >= 60: invokes the schedule skill, returns `path = "schedule_routine"` with a non-empty routine id.

**Path C**: action prints `./scripts/aidd-async-poll.sh` and returns `path = "manual_only"`.
