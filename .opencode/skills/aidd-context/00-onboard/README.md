← [aidd-framework](../../../../README.md) / [aidd-context](../../README.md)

# 00 - Onboard

State-aware guided tour of the `aidd-context` plugin. Probes the project for
existing aidd-context artifacts, picks ONE next aidd-context skill that fits
the current state, and walks the user there. Loops back to detection after
each step so the recommendation always reflects the latest state.

## When to use

- "Where do I start with aidd-context?" / "I'm new to this plugin."
- "Onboard me" or "what should I run next" for aidd-context specifically.
- After a partial setup, to figure out the single concrete next action.

## When NOT to use

- To enumerate every installed skill from raw intent → use `06-discovery`.
- To teach the global cross-plugin AIDD flow → a separate cross-plugin
  onboard owns that scope.
- To run a specific aidd-context skill you already know you need → invoke
  it directly.

## How to invoke

```
Use skill aidd-context:00:onboard
```

The skill walks 3 atomic actions in a loop:

1. `detect-state` - probe the filesystem to snapshot the project's
   aidd-context onboarding state.
2. `recommend-next` - map the state to ONE next aidd-context skill and
   render a numbered choice menu.
3. `execute-or-handoff` - run the chosen skill in-session, hand it off to a
   new session, or explain it; then loop back to `01`.

## Outputs

- A single recommendation per pass (never a full backlog).
- A numbered 5-option menu: run / explain / handoff / swap / stop.
- Updated state detection after each execution.

## Prerequisites

- Plugin `aidd-context` installed and enabled in the Claude Code session.
- A working directory rooted in the target project.

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract, [`actions/`](actions/) for
each of the 3 atomic actions, and `assets/state-matrix.md` for the decision
table that maps detected state to the next aidd-context skill.
