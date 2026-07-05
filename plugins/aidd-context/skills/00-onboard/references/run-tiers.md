# Run tiers

How `03-run` carries out the user's pick. Every step in `checks.md` carries one tier. Only ever run or name a skill that `01` found installed.

## The three tiers

| Tier   | What it is                                  | How onboard runs it                                                        |
| ------ | ------------------------------------------- | -------------------------------------------------------------------------- |
| AUTO   | Non-interactive, safe to spawn and walk away | Invoke the resolved skill, let it run to completion, then move on           |
| GUIDED | Interactive, drives its own Q&A             | Launch the resolved skill in this session, let the user drive it, resume when it returns |
| MANUAL | Side-effecting or outward-facing            | Show the exact command, do not run it, move on and leave it for the user    |

The run mechanism is per step, not one size. An AUTO step may invoke its skill directly or fan out to `aidd-dev:10-todo`; onboard follows the command the check names, never forces a single orchestrator.

## The `OK` walk

When the user replies `OK` to the report, walk the ordered list top to bottom, one step at a time:

1. **AUTO step:** run it to completion, then continue to the next.
2. **GUIDED step:** launch it and hand control to the user. When it returns, continue to the next.
3. **MANUAL step:** show the command, run nothing, note it is left for the user, continue.
4. After the walk, re-scan (`→ 01`) and render the refreshed report.

`OK` drives the whole list, not just a prefix. It pauses at each GUIDED step for the user's input and resumes after, so a greenfield project's setup chain runs end to end from one `OK`. State up front how many steps the walk covers and which need input.

## Other replies

| Reply           | What happens                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------- |
| a step number   | Run that one step per its tier                                                                 |
| explain a step  | Describe the step and its command in two or three plain lines, then re-offer. Never runs a skill |
| explain project | Summarize the project from its memory bank, read-only, then re-offer. Only when memory is filled |
| stop            | One-line close, end the loop                                                                    |
| a gap           | The step has no installed skill. Say it needs a plugin, by function only. Offer explain or stop |

## Loop

After any step runs, re-scan (`→ 01`) and re-render the report so a resolved `✗` flips to `✓`. A read-only reply (explain, stop) does not re-scan. Wait for an explicit reply before running anything.
