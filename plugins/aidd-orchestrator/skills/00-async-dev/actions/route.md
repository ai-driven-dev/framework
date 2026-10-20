# Route

## Input

The skill arguments, prompt, CI trigger payload, and repository state.

## Output

One selected mode: `setup`, `run`, or `review`; or an unresolved/conflict report.

## Process

1. Read `references/routing.md` and apply its signal precedence, aliases, and conflict rules.
2. On a resolved mode, read exactly one of `actions/setup.md`, `actions/run.md`, or `actions/review.md` and follow it to completion. Do not load another mode's sequence.
3. If the routing reference resolves a conflict to a mode, load that mode. Stop before loading a mode only when the reference declares the conflict blocking or the signals unresolved.

## Test

Explicit arguments, CI labels and comments, repository state, and natural language select the same modes as the routing reference. A resolved webhook conflict loads `review`; a blocking conflict or unresolved signal does not load a mode.
