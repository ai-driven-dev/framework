← [framework](../../../../README.md) / [aidd-context](../../README.md)

# 00 - Onboard

A guided tutorial for an AIDD project. It announces itself, shows your AIDD setup up front (AI tools, plugins, memory), then walks you through the framework one step at a time: lay the foundations, then build a feature through the official flow. Nothing runs until you reply.

## When to use

- "Onboard me to this project." / "Get me started."
- "Where do I start?" / "What should I do next?"
- "How does this project stand against AIDD?"
- After a partial setup, to see what is still missing.

## When not to use

- To list every installed surface. Use the explore skill in this plugin.
- To run a specific command you already know. Invoke it directly.

## Flow

Four actions in a loop: `scan → assess → present → run ↺`.

1. `scan`: silently read the project into a snapshot — the checks, the detected AI tools and their wiring, the installed skills. Prints nothing.
2. `assess`: turn the snapshot into one decision — the state, the single next action, and the screen to show.
3. `present`: render that screen and wait for your reply.
4. `run`: carry out the reply. A run or handoff re-scans and loops; a read-only reply (`?`, `back`, `recap`, `explain`) reuses the snapshot; `stop` ends.

## What it shows

- **Your AIDD setup.** AI tools (detected from `.claude`, `.codex`, `.cursor`, `.opencode`, `.github` config), the installed plugins, and the memory bank — each shown as set, present-but-not-wired (with its fix), or required-but-missing. Unused tools are simply omitted.
- **Foundations, state-aware.** An existing project starts with project memory (the stack already exists). A greenfield project designs the stack first.
- **The feature flow.** `brainstorm → spec* → plan → implement → assert → review → commit → PR`. Walk it one command at a time, or hand the whole thing to `aidd-dev:00-sdlc`.

## Replies

Reply with a bracketed key: a number `[1]` to run a step, `[OK]` to walk the pending steps, `[m]` for the flow map, `[?]` for detail, `recap`, `explain <n>`, or `stop`. A step that launches an interactive skill tells you to re-run onboard to come back.

## Requires

Only the `aidd-context` plugin installed and enabled, and a working directory in the target project. The memory bank is not required — on a project without it, the first step is to set it up. Onboard is the entry point, so it works before anything else exists.

## Details

See [`SKILL.md`](SKILL.md) for the router and [`actions/`](actions/) for the four actions. The references live under [`references/`](references/) (`state/`, `order/`, `run/`, and the flow curriculum); the screen shapes are [`assets/report.md`](assets/report.md) with the banner in [`assets/banner.txt`](assets/banner.txt).
