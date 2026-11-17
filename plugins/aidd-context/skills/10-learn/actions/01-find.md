# 01 - Find

Find the durable lessons of a source that the project does not already hold.

## Input

The request, with an optional hint naming a file, a diff or a review.

## Process

1. Pick the source per [signals.md](../references/signals.md).
   - Source unreadable: name it, then stop.
2. Extract each lesson per [signals.md](../references/signals.md), with the passage that shows it.
3. Keep at most seven lessons, in the order of the signals.
4. Search each lesson in `aidd_docs/memory/`, then in the root documents (README, CONTRIBUTING, `docs/`).
   - Already held: drop the lesson and report its `file:line`.
   - `aidd_docs/memory/` absent: ask the user, then hand over to the project memory setup and stop.
5. Nothing left: say so, then stop.
6. Read [propose](02-propose.md).

## Output

The lessons to propose, each with its cited passage and its existing coverage.

## Rules

- Write no file.
