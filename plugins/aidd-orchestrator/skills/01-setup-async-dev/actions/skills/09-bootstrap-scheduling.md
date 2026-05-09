# 09 -- Bootstrap Scheduling

Schedules `scripts/aidd-async-poll.sh` via a Claude Code-native path: a cloud `/schedule` routine OR a Desktop scheduled task. No OS-level cron.

## Inputs

- `answers` (required) -- config object from `02-ask-config`
- `detection` (required) -- detection report from `01-detect-context`

## Outputs

```json
{
  "path": "schedule_routine",
  "routine_id": "...",
  "cron_expression": "*/5 * * * *"
}
```

`path` is `"schedule_routine"` (created by this action) or `"desktop_task_pending"` (the user must finish the Desktop UI step manually).

## Depends on

- `04-generate-local-script`

## Process

1. Skip this action when `answers.mode == "remote"`.
2. Ask the user which path to install:
   - **Path A -- `/schedule` cloud routine** (recommended; runs server-side, machine-independent).
   - **Path B -- Desktop scheduled task** (runs on this machine when awake; user finishes the UI step manually).
3. Ask the cron expression. Default `*/5 * * * *` (every 5 minutes). Validate the expression has 5 space-separated fields.
4. Branch on the chosen path:
   - **Path A**: invoke the runtime `/schedule` skill via the `Skill` tool with the cron expression and the prompt `Use skill aidd-orchestrator:02:run-async-dev on the next ready issue in <owner>/<repo>`. Capture the returned routine id. Print the management URL or command (`/schedule list`).
   - **Path B**: print the four UI steps from `references/local-mode-scheduling.md` (Path A heading), with the working directory, schedule, and prompt fields pre-filled. Set `path = "desktop_task_pending"`.
5. Emit the structured result.

## Test

When Path A is chosen: after running, `/schedule list` returns at least one routine whose prompt contains `aidd-orchestrator:02:run-async-dev` and `<owner>/<repo>`. When Path B is chosen: the action prints a four-bullet checklist that includes the literal working directory and the literal prompt, and `path == "desktop_task_pending"`.
