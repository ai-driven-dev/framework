# 02 - Assess

Turn the snapshot into one decision.

## Input

The project snapshot.

## Output

The decision, ready to render.

## Process

1. **Classify.** State class per `@../references/order/screen-map.md`.
2. **Rank.** Top next action per `@../references/order/ranking.md`.
   - Idle: build the menu per `@../references/order/idle-menu.md`.
3. **Resolve.** Match each command to an installed skill, or name a gap by function when absent.

## Test

- Assess renders nothing.
- Dev-flow, health, and idle stay back while a foundation is unmet.
- An idle decision offers the three umbrellas plus explore.
