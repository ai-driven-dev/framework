# Hermes Agent

1. From the intended profile, run `hermes skills list` to resolve each skill by its installed name. Hermes loads attached skills in order before reading the prompt. The numbered steps in the prompt tell it when to apply each skill and which result feeds the next.
2. Map the trigger to a one-shot delay or timestamp, an interval such as `every 2h`, or a five-field cron expression. Pin the IANA zone for a wall-clock schedule. Supply an existing absolute `--workdir` when the task needs project rules or files. Set the agreed delivery target. When a valid empty result should suppress delivery, instruct the run to return only `[SILENT]` on that branch.
3. For example, with the complete prompt in `task.md` and both skill names resolved in shell variables, the registration command is:

   ```sh
   hermes cron create '0 9 * * 1-5' "$(cat task.md)" \
     --name 'Weekday brief' --timezone Europe/Paris --deliver local --workdir "$PWD" \
     --skill "$collect_skill" --skill "$summarize_skill"
   ```

4. On registration, compare the returned ID, cadence and next run with `hermes cron list --all`. Use `hermes cron status` to check the scheduler. The gateway must run for jobs to fire. For a paused registration, add `--paused`.

Hermes discovers the generator itself from the profile's skills directory or a configured `skills.external_dirs` root. Use its installed slash name in chat.

[Scheduled tasks](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron) · [Skills](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills) · [Documentation index](https://hermes-agent.nousresearch.com/docs/llms.txt)
