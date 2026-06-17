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

1. `read-project`: **silently** read a few plain facts about the project and the installed skills. Prints nothing.
2. `orient`: explain where the project sits in the AIDD flow and suggest the next step, in plain language, then offer choices.
3. `act`: run the suggestion, explain it, walk the whole flow, switch to a different step, hand off, or stop. Then loop back to `01`.

It suggests by **function**, then resolves that to whatever skill is actually installed. A step with no installed skill is named as a gap, never an invented recommendation. The suggested step is always a hint, never a forced choice.

## Requires

Only the `aidd-context` plugin installed and enabled, and a working directory rooted in the target project. The `aidd_docs/` memory bank is **not** required: on a project without it, onboard's first suggestion is to set it up (the Context step). Onboard is the entry point, so it works before anything else exists.

## Details

See [`SKILL.md`](SKILL.md) for the action contract, [`actions/`](actions/) for the three actions, and [`references/journey.md`](references/journey.md) for the AIDD flow stages and how each resolves to an installed skill.
