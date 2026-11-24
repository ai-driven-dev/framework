# Claude Code

1. For a persistent cloud task, use `/schedule` in Claude Code or the cloud Scheduled tasks form. Supply the prompt, cadence, repositories and connectors needed by a fresh cloud session. A preset uses local time. A bare five-field cron uses UTC. Preserve a displayed `CRON_TZ=` prefix to use its zone. Cloud schedules support hourly or slower recurrence and one-off times.
2. When the task needs local files and must survive session closure, choose Desktop Scheduled → New task, select the local folder, and enter the instructions and schedule in local time. The machine must be awake and the desktop app running. For a task explicitly limited to an open session, `/loop 5m <prompt>` repeats within that session.
3. For cloud tasks, use `/schedule list` or reopen the task in the web UI to check the saved trigger and its settings. For Desktop or session tasks, inspect the Desktop Scheduled view or ask Claude to list the session's scheduled tasks.

[Cloud scheduled tasks](https://code.claude.com/docs/en/routines) · [Desktop tasks](https://code.claude.com/docs/en/desktop-scheduled-tasks) · [Scheduling surfaces](https://code.claude.com/docs/en/scheduled-tasks) · [Documentation index](https://code.claude.com/docs/llms.txt)
