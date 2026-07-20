# 02 - Gather

Read the source and extract candidate lessons.

## Input

The selected source descriptions.

## Output

A list of candidate learnings grounded in evidence, or no candidates when nothing is worth persisting.

## Process

1. Apply [gather protocol](../references/gather-protocol.md) to the selected sources.
2. Extract durable signals with evidence.
3. Drop noise and already-useless items.
4. Emit the candidate list, or end with no candidates.

## Test

- Each candidate has source, evidence, learning, and persistence reason.
- No candidate comes from an unselected source.
