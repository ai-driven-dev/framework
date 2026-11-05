# 03 - Conclude

Leave a design system that validates, and tell the user what follows.

## Input

`<engine>`, the files written, and `bump`'s JSON for a change.

## Process

1. Run `node <engine> validate` and fix each error line under `aidd_docs/ui/`, as its `=> fix` says; the `warning` lines are not errors; repeat until no error is left. An error in the code (C4, C6) is left: this skill never writes the code.
2. Reply to the user with:
   - the elements created or raised, with their versions; for a change, also those `bump` left, from its `left` list;
   - what `validate` still prints, errors in the code included;
   - that the code is untouched, and that each element stays `proposed` until the user, after looking at its render, runs `node <engine> publish <id>`.

## Output

The reply to the user.
