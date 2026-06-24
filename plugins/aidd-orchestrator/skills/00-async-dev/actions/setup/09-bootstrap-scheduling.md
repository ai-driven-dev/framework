# 09 -- Bootstrap Scheduling

Schedules `scripts/aidd-async-poll.sh` via the cheapest path that fits the user's needs. **Never recommends OS-level cron**, but for the local daemon path uses tmux/launchd/systemd so the user keeps Claude Code's Tasks quota for other things.

## Input
- `answers` (required) -- config object from `02-ask-config`
- `detection` (required) -- detection report from `01-detect-context`

## Output
```json
{
  "path": "local_daemon",
  "interval_seconds": 300,
  "supervisor": "tmux",
  "supervisor_artefact": "scripts/aidd-async-daemon.sh"
}
```

`path` is one of: `manual`, `local_daemon`, `desktop_task_pending`, `schedule_routine`.

## Depends on

- `04-generate-local-script`

## Process

1. Skip when `answers.mode == "remote"`. Print: "Remote mode runs the pipeline on GitHub Actions; no local scheduling needed."
2. Print the cadence and quota tradeoffs up front so the user picks the path that matches their needs:

   | # | Path | Uses Claude Tasks quota | Min interval | Persistence |
   | - | ---- | ----------------------- | ------------ | ----------- |
   | C | Local daemon (tmux/launchd/systemd) **(recommended local default)** | no | seconds | supervisor-managed |
   | B | Manual run on demand | no | n/a | none |
   | D | Desktop scheduled task | **yes (1 per tick)** | 1 minute | machine awake |
   | E | `/schedule` cloud routine | **yes (1 routine)** | 1 hour | server-side |

3. Ask the user to pick C, B, D, or E. Default C.
4. Branch on the choice:
   - **C (local daemon)**:
     - Render `scripts/aidd-async-daemon.sh` from `assets/local-daemon-template.sh` (no placeholders to substitute today; the daemon delegates to `aidd-async-poll.sh`). Write with mode `0755`.
     - Ask the supervisor: `tmux`, `launchd` (macOS), `systemd-user` (Linux), or `nohup`. Default `tmux`.
     - Ask the interval in seconds (default `300`).
     - Print the exact one-liner for the chosen supervisor (templates in `references/local-mode-scheduling.md`, Path C). Do not install the supervisor automatically; the user runs the printed command.
     - Set `path = "local_daemon"`.
   - **B (manual)**: print `./scripts/aidd-async-poll.sh` and a reminder that nothing runs until invoked. Set `path = "manual"`.
   - **D (Desktop task)**: print the four UI bullets from the reference (Path D), filled with the working directory, schedule, and prompt. Warn about the per-tick Tasks quota. Set `path = "desktop_task_pending"`.
   - **E (cloud routine)**: invoke the runtime `/schedule` skill via the `Skill` tool with a cron expression (must be at least hourly) and the prompt `Use skill aidd-orchestrator:00-async-dev with action=run on the next ready issue in <owner>/<repo>`. Capture the routine id. Set `path = "schedule_routine"`.
5. Emit the structured result.

## Test

**Path C (default)**: action writes `scripts/aidd-async-daemon.sh` with mode 0755, prints the chosen supervisor's one-liner with the absolute repo path filled in, and returns `path = "local_daemon"` with the chosen interval. The daemon script does NOT mention Claude Code Scheduled Tasks.

**Path B**: returns `path = "manual"` and prints exactly `./scripts/aidd-async-poll.sh`.

**Path D**: prints the four UI bullets and a warning about Tasks quota; returns `path = "desktop_task_pending"`.

**Path E with interval = 30**: action rejects (cloud routines minimum 1 hour) and re-prompts. With interval >= 60: invokes the schedule skill, returns `path = "schedule_routine"` with a non-empty routine id.
