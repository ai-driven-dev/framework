# 03 - Conclude

Leave a design system that validates, and tell the user what follows.

## Input

`<engine>`, the files written, and for a change `bump`'s JSON and the agreed impact.

## Process

1. Run `node <engine> validate` and fix each error line under `aidd_docs/ui/` as its `=> fix` says, except a fix that runs `publish`: validating is the user's. Repeat until the only errors left are in the code (C4, C6); the `warning` lines are not errors.
2. Reply to the user with:
   - the elements and screens created or raised, with their versions; for a change, also those `bump` left, from its `left` list;
   - what `validate` still prints, errors in the code included;
   - for a change, the `code` files `impact` listed, the `code-tokens` files among them, still holding the old values;
   - that the code is untouched, and that each element created or raised is `proposed` until the user, after looking at its render, runs `node <engine> publish <id>`.

## Output

The reply to the user.
