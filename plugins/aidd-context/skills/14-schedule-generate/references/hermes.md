# Hermes Agent

In the target profile, resolve skill names with `hermes skills list`. Repeat `--skill` in load order. For a weekday task with its full prompt in `task.md`, replace the example skill names with installed ones.

```sh
hermes cron create '0 9 * * 1-5' "$(cat task.md)" \
  --name 'Weekday brief' --timezone Europe/Paris --workdir "$PWD" \
  --skill collect --skill summarize --deliver local
```

Set the requested delivery target. Return only `[SILENT]` when a run should skip delivery. Verify the job ID and next run with `hermes cron list --all`. The gateway must be running. [Scheduled tasks](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron)
