# 02 - Assess

Turn the scan snapshot into one decision: state class, ranked next action, chosen screen. Render nothing.

## Input

The snapshot from `01-scan`, held in context.

## Output

A decision handed to `03-present`: the state class, the top-ranked next action (or the idle menu), and the screen to render. Nothing is printed.

## Process

1. **Classify.** Map the snapshot to a state class per `@../references/order/screen-map.md`.
2. **Rank.** Pick the top next action per `@../references/order/ranking.md`. When idle, build the menu per `@../references/order/idle-menu.md`.
3. **Resolve.** Resolve each offered command against the installed skills from `01`; name a gap by function when the skill is absent, never invent one.
4. **Hand.** Pass the decision to `03-present`. Render nothing here.

## Test

- The action outputs a decision and renders nothing.
- Ranking holds the dev-flow, health, and idle steps back while a foundation is unmet.
- An idle decision names the three umbrellas plus explore, each umbrella carrying its installed members.
- No uninstalled command is named; an absent one is a gap by function.
