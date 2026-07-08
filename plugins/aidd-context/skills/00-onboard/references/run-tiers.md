# Run tiers

How `03-run` carries out the user's pick. Every step in `checks.md` carries one default tier (see the note below). Only ever run or name a skill that `01` found installed.

## The three tiers

| Tier   | What it is                                  | How onboard runs it                                                        |
| ------ | ------------------------------------------- | -------------------------------------------------------------------------- |
| AUTO   | Non-interactive, safe to spawn and walk away | Invoke the resolved skill, let it run to completion, then move on           |
| GUIDED | Interactive, drives its own Q&A             | Launch the resolved skill in this session, let the user drive it, resume when it returns. State the return path on handoff (see Returning) |
| MANUAL | Side-effecting or outward-facing            | Show the exact command, do not run it, move on and leave it for the user    |

The run mechanism is per step, not one size. An AUTO step may invoke its skill directly or fan out to `aidd-dev:10-todo`; onboard follows the command the check names, never forces a single orchestrator.

**The tier is a default, not a fixed skill property.** Many skills run either way depending on how they are invoked (interactive by default, unattended on request, e.g. `aidd-dev:00-sdlc`). Each step in `checks.md` carries the tier that fits its default use, and the report phrases it as a plain clause telling the user what happens if they just run it. The user can override per invocation: ask to run a GUIDED step unattended, or an AUTO step interactively, and onboard invokes the skill in that mode when the skill supports it.

## Returning to onboard

Handing off a GUIDED step launches another skill, which may not return control on its own. So on every handoff, tell the user one line: re-run onboard to come back and continue (the deterministic path is the slash command for this skill). The re-run re-scans, and the session ledger drops the step just handed off, so the user resumes where they left off rather than repeating it.

## The `OK` walk

When the user replies `OK` to the report, walk the ordered list top to bottom, one step at a time:

1. **AUTO step:** run it to completion, then continue to the next.
2. **GUIDED step:** launch it and hand control to the user. When it returns, continue to the next.
3. **MANUAL step:** show the command, run nothing, note it is left for the user, continue.
4. After the walk, re-scan (`→ 01`) and render the refreshed report.

`OK` drives the whole list, not just a prefix. It pauses at each GUIDED step for the user's input and resumes after, so a greenfield project's setup chain runs end to end from one `OK`. State up front how many steps the walk covers and which need input.

The idle menu (checks.md rank 4) is the exception: it is a set of choices, not a chain, so `OK` never walks it. When the list is only the idle menu, there is nothing for `OK` to run; the user picks one item by number.

## Other replies

| Reply           | What happens                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------- |
| a step number   | Run that step per its tier. If the number is an idle-menu umbrella (`improve the project`, `customize the AI`), re-render its installed member sub-list to pick from instead of running |
| `?`             | Expand the full detail (each step's command id and tier clause, the per-check foundation reasons, the read-only extras), read-only, then re-offer |
| skip a step     | Record it left in the session ledger (checks.md Done rule); it does not re-fire next scan       |
| explain a step  | Describe the step and its command in two or three plain lines, then re-offer. Never runs a skill |
| explain project | Summarize the project from its memory bank, read-only, then re-offer. Only when memory is filled |
| recap           | Summarize this session's conversation (what was worked on, decided, still pending), read-only, then re-offer. Only when a prior conversation exists this session, never on a first-message onboard |
| stop            | One-line close, end the loop                                                                    |
| a gap           | The step has no installed skill. Say it needs a plugin, by function only. Offer explain or stop |

## Loop

After any step runs, re-scan (`→ 01`) and re-render the report so a resolved `✗` flips to `✓`. A read-only reply (`?`, explain, explain project, recap, stop) and an umbrella pick (which only re-renders a sub-list) do not re-scan. Wait for an explicit reply before running anything.
