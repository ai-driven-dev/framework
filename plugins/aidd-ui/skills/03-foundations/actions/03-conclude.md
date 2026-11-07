# 03 - Conclude

Leave foundations that validate, and tell the user what follows.

## Input

The output of [write](02-write.md).

## Process

1. Run `node <engine> validate`.
2. Fix each error line under `aidd_docs/ui/` as its `=> fix` says.
3. Skip a fix that runs `publish`: validating is the user's.
4. Repeat until only these remain:
   - errors in the code (C4, C6, C10)
   - errors owed by a later step
   - `warning` lines, which are not errors
5. Reply with:
   - the tokens and the system written, with their versions
   - for a change, the elements and screens left in `bump`'s `left`
   - what `validate` still prints, code errors included
   - for a change, the `code` files `impact` listed, with old values
   - that the code is untouched
   - that each element created or raised is `proposed` until published
   - that the user publishes with `node <engine> publish <id>`
   - that the user does so after looking at its render.

## Output

The reply to the user.
