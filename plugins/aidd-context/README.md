← [aidd-framework](../../README.md)

# aidd-context

Project knowledge: memory, context files and generators.

| | |
| --- | --- |
| Status | stable |
| Install | `/plugin install aidd-context@aidd-framework` |
| Start with | `/aidd-context:00-onboard` |
| Skills, agents, hooks | [Catalog](../../docs/CATALOG.md#-aidd-context) |

## Generate a scheduled task in Hermes

From the framework checkout, install in the default profile:

```sh
mkdir -p ~/.hermes/skills
cp -R plugins/aidd-context/skills/14-schedule-generate ~/.hermes/skills/
hermes -p default skills list
```

For a named profile, use its `skills/` directory and replace `default` with the profile name. [Hermes skills](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills) · [Hermes profiles](https://hermes-agent.nousresearch.com/docs/user-guide/profiles)

With both example skills installed, open a new Hermes chat. Approve the one-off test, review its output, then decide whether to enable the schedule.

> /14-schedule-generate Draft and test a weekday task at 09:00 Europe/Paris. Pass yesterday’s notes from collect-notes to write-digest. Save the digest in reports/ and skip empty days.

## Hooks

| Event | When | Does |
| --- | --- | --- |
| `SessionStart` | a session opens | refreshes the memory block of each context file, silently, so a new memory file is loaded |
| `Stop` | the model ends its turn | refreshes the same blocks; names a context file it could not refresh while that file misses a memory file |

`SessionStart` runs `hooks/memory.cjs load`, `Stop` runs `hooks/memory.cjs sync`. Every tool in [Compatibility](../../docs/COMPATIBILITY.md) with hooks receives them; Antigravity receives `SessionStart` only, so a memory file added during a session reaches its context file at the next one. A missing always-written file is the skill's: its script creates it from the template.

The hook keeps no state and lints nothing. The skill checks the memory it writes with its own script, against the lines written since the bank's last commit.
