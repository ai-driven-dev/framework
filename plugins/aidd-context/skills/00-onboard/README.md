← [aidd-framework](../../../../README.md) / [aidd-context](../../README.md)

# 00 - Onboard

State-aware onboarding **hub** for the current project. Silently probes the
project, its AIDD setup, and which AIDD plugins are installed, then opens a
short briefing and a menu of project actions. Loops back to detection after
each action so the briefing always reflects the latest state.

## When to use

- "Where do I start?" / "Onboard me to this project."
- "What should I run next?" / "What should I work on next?"
- "What's the current state of this project?"
- After a partial setup, to figure out what to do next.

## When NOT to use

- To enumerate every installed surface from raw intent -> use the discovery
  skill in this plugin.
- To run a specific AIDD skill you already know you need -> invoke it directly.

## How to invoke

```
Use skill aidd-context:00:onboard
```

The skill walks 3 atomic actions in a loop:

1. `detect-state` - **silently** probe the filesystem, the project context,
   and the installed AIDD surface. Prints nothing.
2. `recommend-next` - render the briefing header and the hub menu, route the
   user's pick to one concrete action.
3. `execute-or-handoff` - carry out the choice (briefing, run, explain,
   handoff, swap, stop), then loop back to `01`.

## The hub menu

Every pass opens with a three-line briefing (project, AIDD setup, standing),
then this menu:

1. **Understand this project** - a full briefing on state, stack, AIDD setup,
   and where the project stands.
2. **Memory bank** - set it up if absent, refresh it if present.
3. **Continue the SDLC** - open the journey sub-menu and pick a development leg.
4. **List every installed surface** - open the discovery skill.
5. **Stop**.

## The AIDD journey

`bootstrap -> context-setup -> refine -> specify -> plan -> implement -> review -> ship`

The first two legs (`bootstrap`, `context-setup`) are reached through hub
option 2 (Memory bank); the remaining six (`refine` through `ship`) through the
SDLC sub-menu under hub option 3.

Onboard recommends by **category** (a function), then resolves the category to
whatever installed skill fits. A leg with no installed skill is reported as a
gap, never as an invented recommendation. The detected SDLC phase is shown only
as a hint - onboard never forces a leg or assumes a phase is finished.

## Outputs

- A clean three-line project briefing (no raw snapshot, no `Analysis:` noise).
- A hub menu of project actions, with one option marked as the suggested start.
- Numbered sub-menus for the SDLC journey and for a resolved skill.
- Updated detection after each action.

## Prerequisites

- Plugin `aidd-context` installed and enabled in the AI tool.
- A working directory rooted in the target project.

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract, [`actions/`](actions/) for
each of the 3 atomic actions, and `assets/state-matrix.md` for the hub menu,
the SDLC sub-menu, the journey backbone, and the category resolution rules.
