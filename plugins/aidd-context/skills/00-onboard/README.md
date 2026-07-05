← [framework](../../../../README.md) / [aidd-context](../../README.md)

# 00 - Onboard

A linter for an AIDD project. It scans the working directory against the framework, reports what is present, drifting, or missing as an explicit `✅ ⚠️ ❌` checklist, and hands back a single ordered list of the exact commands to run next. Reply `OK` and it walks the whole list for you, pausing at each step that needs your input.

## When to use

- "Where do I start?" / "Onboard me to this project."
- "What should I do next?"
- "How does this project stand against AIDD?"
- After a partial setup, to see what is still missing.

## When not to use

- To list every installed surface. Use the explore skill in this plugin.
- To run a specific command you already know. Invoke it directly.

## Flow

Three actions, in a loop:

1. `scan`: **silently** read the project once into a snapshot of every check across four zones. Prints nothing.
2. `report`: render the loud diagnostic plus one ordered command list, foundations first, then the dev flow, each line naming a concrete installed command and its run tier.
3. `run`: carry out the reply. `OK` walks the whole list, running the unattended steps and pausing at each interactive one; a number runs one step; then re-scan and refresh.

It scans four zones: AIDD context (memory, the `<aidd_project_memory>` block, architecture), context-gen artifacts (rules, agents, skills, hooks, commands), the dev flow (code, tests, spec or plan, PR), and health (bug markers, messy code). A check is met by a disk fact and flagged `⚠` on form drift. It never checks a plugin version against a registry.

## Run tiers

Each recommended step is one of three: **AUTO** (spawn and run to completion), **GUIDED** (an interactive skill onboard launches and hands to you), or **MANUAL** (a side-effecting command it shows but never runs). `OK` walks all three in order, running AUTO steps, pausing at each GUIDED step for your input, and leaving MANUAL commands for you to run.

## Requires

Only the `aidd-context` plugin installed and enabled, and a working directory rooted in the target project. The `aidd_docs/` memory bank is **not** required: on a project without it, the first recommendation is to set it up. Onboard is the entry point, so it works before anything else exists.

## Details

See [`SKILL.md`](SKILL.md) for the action contract and [`actions/`](actions/) for the three actions. The catalogue lives in [`references/checks.md`](references/checks.md) (the four zones and their checks) and [`references/run-tiers.md`](references/run-tiers.md) (the tiers and the `OK` chain); the report shape is [`assets/report.md`](assets/report.md).
