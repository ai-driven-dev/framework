# Local-mode scheduling

Two Claude Code-native ways to run `scripts/aidd-async-poll.sh` on a schedule. Pick one. Both stay inside Claude Code; neither needs OS-level cron or launchd.

## Path A -- Claude Code Desktop scheduled task

Best for: users who want the schedule to live on their machine and run only when the laptop is awake.

1. Open Claude Code Desktop.
2. Open the scheduled tasks panel (settings -> Scheduled tasks -> New task).
3. Fill the form:
   - **Working directory**: the absolute path of this repo
   - **Schedule**: every 5 minutes (or whatever cadence you want)
   - **Prompt**: `Run ./scripts/aidd-async-poll.sh and report what was processed.`
4. Save. The Desktop will run the script in a fresh session at each tick.

To pause: disable the task in the same panel. To remove: delete the task.

## Path B -- `/schedule` skill (cloud routine)

Best for: users who want the schedule to keep running even when their machine is off, and accept that the cycle runs on Anthropic's cloud.

1. Open any Claude Code session in this repo.
2. Run the `/schedule` skill with this exact input (placeholders are already filled in):

   ```
   /schedule
   cron: */5 * * * *
   prompt: Use skill aidd-orchestrator:02:run-async-dev on the next ready issue in {owner}/{repo}
   ```

3. Confirm. The routine appears in your Claude Code account and runs server-side.

To pause: `/schedule list`, then disable the routine. To remove: delete it from the same UI.

## Sanity check first

Before scheduling either path, run the script once manually to make sure it picks up the right issues:

```
./scripts/aidd-async-poll.sh --dry-run    # lists what it would do
./scripts/aidd-async-poll.sh              # runs once for real
```

If the script reports `no open issues with label to-implement`, label one issue with `to-implement` and try again.

## Why no OS-level cron?

OS-level cron and launchd work, but they:
- bypass Claude Code's session boundary (each tick spawns a brand-new `claude -p`),
- are harder to see and pause from inside Claude Code,
- silently fail when `claude` is not on the PATH of the cron user.

The two paths above keep the schedule visible inside Claude Code, where the rest of the workflow already lives.
