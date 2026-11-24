# Google Antigravity

| Surface | Setup and limits | Verify |
| --- | --- | --- |
| CLI or app conversation | Use `/schedule` with the delay or five-field recurring cron and the rendered prompt. The timer belongs to the current conversation. Recurring tasks can specify a maximum iteration count. | Open `/tasks` in the CLI or inspect the Timed or Scheduled step in the app. [Schedule guide in Markdown](https://antigravity.google/docs/commands/schedule.md) |
| App background automation | Use `/automation` for a standing task. Supply the prompt, cadence, and timezone. The app resolves these to cron with an IANA zone. New automations start paused, and unattended runs require the necessary permissions. | Open the saved entry in Automations, compare its ID, schedule, task and permissions, and report its paused or enabled state. [Automation guide in Markdown](https://antigravity.google/docs/commands/automation.md) |

[Official documentation index](https://antigravity.google/llms.txt)
