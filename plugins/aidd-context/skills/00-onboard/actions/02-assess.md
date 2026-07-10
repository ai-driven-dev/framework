# 02 - Assess

Turn the snapshot into one decision.

## Input

The snapshot from `01-scan`.

## Output

A decision for `03-present`: state class, top next action or idle menu, and the screen.

## Process

1. **Classify.** State class per `@../references/order/screen-map.md`.
2. **Rank.** Top next action per `@../references/order/ranking.md`.
   - Idle: build the menu per `@../references/order/idle-menu.md`.
3. **Resolve.** Match each command to an installed skill; an absent one is a gap by function.
4. **Hand.** Pass the decision to `03-present`.

## Test

- Assess renders nothing.
- Dev-flow, health, and idle stay back while a foundation is unmet.
- An idle decision offers the three umbrellas plus explore.
