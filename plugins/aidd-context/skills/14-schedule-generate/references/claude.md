# Claude Code

- Cloud. Give `/schedule` the prompt, repositories, connectors and time. Recurrence is hourly or slower. Presets use local time. Bare cron uses UTC unless it carries a `CRON_TZ=` prefix. Inspect with `/schedule list`. [Cloud scheduled tasks](https://code.claude.com/docs/en/routines)
- Local project. Use Desktop → Scheduled → New task for a recurring prompt in a local folder. The app must remain open and the machine awake. [Desktop tasks](https://code.claude.com/docs/en/desktop-scheduled-tasks)
- Current session. Use `/loop 5m <prompt>` to repeat while the session is open. [Session scheduling](https://code.claude.com/docs/en/scheduled-tasks)
