← [framework](../../../../README.md) / [aidd-context](../../README.md)

# 00 - Onboard

A plain-language guide to the AIDD framework for the current project. It reads the project lightly, explains where the project sits in the AIDD flow, and suggests the next logical step, using only the plugins that are installed. It teaches as it goes and never assumes you already know the framework.

## When to use

- "Where do I start?" / "Onboard me to this project."
- "What should I do next?"
- "How does AIDD work?"
- After a partial setup, to figure out the next move.

## When not to use

- To list every installed surface. Use the explore skill in this plugin.
- To run a specific skill you already know you need. Invoke it directly.

## Flow

Three actions, in a loop:

1. `read-project`: **silently** read the project once into a reusable snapshot — the signals plus a session ledger of what you have run or skipped. Prints nothing.
2. `orient`: place the project in the AIDD flow and offer a project-adapted menu — the recommended next step plus the tools that fit, in plain language.
3. `act`: run the suggestion, explain it, walk the whole flow, switch to a different step, hand off, or stop. Then refresh the snapshot and loop.

It suggests by **function**, then resolves that to whatever skill is actually installed. A step with no installed skill is named as a gap, never an invented recommendation. The recommended step is always skippable, never a forced choice, and once run or skipped it is not suggested again.

## Requires

Only the `aidd-context` plugin installed and enabled, and a working directory rooted in the target project. The `aidd_docs/` memory bank is **not** required: on a project without it, onboard's first suggestion is to set it up (the Context step). Onboard is the entry point, so it works before anything else exists.

## Details

See [`SKILL.md`](SKILL.md) for the action contract and [`actions/`](actions/) for the three actions. The detail lives in [`references/journey.md`](references/journey.md) (flow stages and placement), [`references/signals.md`](references/signals.md) (project signals and the capability map), and [`assets/menu.md`](assets/menu.md) (the menu shape).
