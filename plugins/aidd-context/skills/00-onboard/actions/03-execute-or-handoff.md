# 03 - Execute or handoff

Carry out the single action that `02-recommend-next` resolved: print the project briefing, run the resolved skill, explain it, hand it off, swap the choice, or stop.

## Inputs

- `action` (required) - one of `briefing`, `run`, `explain`, `handoff`, `swap`, `stop`.
- `skill` - the resolved skill id, or `gap` when no installed skill matched. Required for `run`, `explain`, `handoff`.
- `category` - the category `02-recommend-next` resolved.
- `origin_menu` - `hub` or `sdlc`, the menu the user last picked from. Used by `swap`.
- Internal state from `01-detect-state` - held in conversation context, the source for the `briefing` content.

## Outputs

The user sees one of six outcomes. Every outcome ends with an explicit next instruction (a re-detect loop, a menu re-render, or a stop).

| Action     | Outcome                                                                                                          | Loop back to action 01? |
| ---------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `briefing` | Print the full project briefing. Read-only, no writes.                                                           | yes                     |
| `run`      | Skill invoked inline in this session. After it finishes, ask the user to confirm the result with `ok / not ok / explain`. | yes, after confirmation |
| `explain`  | Print a 3 to 5 line plain-text summary of the skill. Then re-render the skill menu from action 02.                | no, re-render menu      |
| `handoff`  | Print the exact invocation string for a new session. Ask the user to paste it and report back.                   | yes, after report-back  |
| `swap`     | Re-render the menu the user last picked from (`origin_menu`: hub or SDLC sub-menu).                               | no, back to action 02   |
| `stop`     | Print a one-line goodbye. End the loop.                                                                           | no, terminate           |

## Process

1. **Branch on `action`.**
2. **`briefing`.** Print the full project briefing from the internal state: project name and stack, AIDD setup detail (memory bank state, context block, `INSTALL.md`), SDLC standing with its reasoning and the hedge that "source code present" cannot prove done-ness, the installed AIDD plugins and what each unlocks described by function, and the suggested starting point. No writes. Then return to action 01 to re-detect and re-render the hub.
3. **`run`.** Invoke `skill` the same way a slash command would. Stream its output. Once it returns, ask: `Result OK? Reply ok / not ok / explain.` Wait. On `ok`, return to action 01. On `not ok`, ask one follow-up to capture what went wrong, then return to action 01.
4. **`explain`.** Pull the `description` frontmatter from the resolved `skill`'s `SKILL.md`. Render: 1 line purpose, 1 to 2 lines on what it produces, 1 line on side effects. Do not invoke. Re-render the skill menu unchanged.
5. **`handoff`.** Print: `Open a new session and run: /<skill-id>`. Then: `Reply done when you've come back with the result.` Wait. On `done`, return to action 01.
6. **`swap`.** Return to action 02 and re-render the menu named by `origin_menu`: the hub menu if `hub`, the SDLC sub-menu if `sdlc`. The user picks again. Do not invoke anything.
7. **`stop`.** Print the goodbye line. Terminate the skill cleanly. Do not loop.
8. **`gap` skill.** If `skill` is `gap`, `run` and `handoff` are unavailable. Tell the user the action needs an AIDD plugin that is not installed, by function only, then offer `explain`, `swap`, or `stop`.
9. **Resolve, never invent.** Only ever invoke or name a skill that action 01 found installed. Never name a skill or plugin that is not installed.

## Test

- `briefing` prints the full project briefing and writes nothing, then loops back to action 01.
- `run` produces a skill invocation and ends with an `ok / not ok / explain` prompt.
- `explain` produces a 3 to 5 line description and re-renders the skill menu without invoking anything.
- `handoff` produces an exact `/<skill-id>` invocation string and a `done` wait state.
- `swap` re-renders the menu named by `origin_menu` (hub or SDLC sub-menu) and invokes nothing.
- `stop` prints a goodbye and the skill exits.
- A `gap` skill never produces a skill invocation; it offers explain, swap, or stop only.
