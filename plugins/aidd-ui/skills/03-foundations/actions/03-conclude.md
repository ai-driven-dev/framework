# 03 - Conclude

Leave foundations that validate, and tell the user what follows.

## Input

`<engine>`, the files written, and for a change `bump`'s JSON and the agreed impact.

## Process

1. Run `node <engine> validate` and fix each error line under `aidd_docs/ui/` as its `=> fix` says, except a fix that runs `publish`: validating is the user's. Repeat until the only errors left are in the code (C4, C6, C10) or owed by a later step; the `warning` lines are not errors.
2. Reply to the user with:
   - the tokens and the system written, with their versions; for a change, also the elements and screens `bump` left, from its `left` list;
   - what `validate` still prints, errors in the code included;
   - for a change, the `code` files `impact` listed, which still hold the old values;
   - that the code is untouched, and that each element created or raised is `proposed` until the user, after looking at its render, runs `node <engine> publish <id>`.

## Output

The reply to the user.
