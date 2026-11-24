# Hermes Agent

In the target profile, resolve skill names with `hermes skills list`. Repeat `--skill` in load order. For the approved trial, use a near-future ISO timestamp with its UTC offset in place of the recurring expression below. Follow the trial ID with `hermes cron runs <id>` and inspect its output.

After approval to activate, register the recurring expression with the same tested prompt, skills, workspace and delivery settings.

```sh
hermes cron create '0 9 * * 1-5' "$(cat task.md)" \
  --name 'Weekday brief' --timezone Europe/Paris --workdir "$PWD" \
  --skill collect --skill summarize --deliver local
```

Set the requested delivery target. Return only `[SILENT]` when a run should skip delivery. Verify the job ID and next run with `hermes cron list --all`. The gateway must be running. [Scheduled tasks](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron)
