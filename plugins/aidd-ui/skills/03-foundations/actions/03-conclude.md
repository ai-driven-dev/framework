# 03 - Conclude

Leave foundations that validate, and tell the user what follows.

## Input

The output of [write](02-write.md).

## Process

1. Validate per [engine](../references/engine.md).
2. Fix each error line under `aidd_docs/ui/` as its `=> fix` says.
3. Skip a fix that publishes, per [engine](../references/engine.md): validating is the user's.
4. Validate again per [engine](../references/engine.md), and repeat until only these remain:
   - errors the [engine](../references/engine.md) says are about the code
   - errors the [engine](../references/engine.md) says another skill owes
   - `warning` lines, which are not errors
5. Reply with:
   - the tokens and the system written, with their versions
   - the elements and screens the raise left, for a change
   - what the validation still prints
   - the `code` files listed, still holding old values, for a change
   - that the code is untouched
   - that each element created or raised is `proposed` until published
   - that the user publishes each per [engine](../references/engine.md)
   - that the user does so after looking at its render

## Output

The reply to the user.
