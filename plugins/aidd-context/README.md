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

From a framework checkout, copy the full skill into the profile that will run the task. For the default profile, run the following commands.

```sh
mkdir -p ~/.hermes/skills
cp -R plugins/aidd-context/skills/14-schedule-generate ~/.hermes/skills/
hermes -p default skills list
```

For a named profile, use its `skills/` directory (normally `~/.hermes/profiles/<name>/skills/`) and replace `default` with the profile name. Look for `14-schedule-generate` in the list, then open a new chat in that profile. [Hermes skills](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills) · [Hermes profiles](https://hermes-agent.nousresearch.com/docs/user-guide/profiles)

For a profile with `collect-notes` and `write-digest` installed, try this request.

> Use 14-schedule-generate to draft a weekday task for 09:00 Europe/Paris. Run collect-notes on yesterday’s notes, then pass its result to write-digest. Save the digest in reports/ and skip days with no notes.

## Hooks

| Event | When | Does |
| --- | --- | --- |
| `SessionStart` | a session opens | refreshes the memory block of each context file, silently, so a new memory file is loaded |
| `Stop` | the model ends its turn | refreshes the same blocks; names a context file it could not refresh while that file misses a memory file |

`SessionStart` runs `hooks/memory.cjs load`, `Stop` runs `hooks/memory.cjs sync`. Every tool in [Compatibility](../../docs/COMPATIBILITY.md) with hooks receives them; Antigravity receives `SessionStart` only, so a memory file added during a session reaches its context file at the next one. A missing always-written file is the skill's: its script creates it from the template.

The hook keeps no state and lints nothing. The skill checks the memory it writes with its own script, against the lines written since the bank's last commit.
