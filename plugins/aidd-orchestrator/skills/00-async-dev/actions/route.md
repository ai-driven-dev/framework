# Route

## Input

The skill arguments, prompt, CI trigger payload, and repository state.

## Output

One selected mode: `setup`, `run`, or `review`; or an unresolved/conflict report.

## Process

1. Read `references/routing.md` and apply its signal precedence, aliases, and conflict rules.
2. On a resolved mode, read exactly one of `actions/setup.md`, `actions/run.md`, or `actions/review.md` and follow it to completion. Do not load another mode's sequence.
3. On an unresolved or conflicting request, surface the decision from the routing reference and stop before loading a mode.

## Test

Explicit arguments, CI labels and comments, repository state, and natural language select the same modes as the routing reference. A conflict or unresolved signal does not load a mode.
