# 03 - Conclude

Leave components that validate, and tell the user what follows.

## Input

The output of [write](02-write.md).

## Process

1. Validate per [engine](../references/engine.md).
2. Fix each error line under `aidd_docs/ui/` as its `=> fix` says.
3. Skip a fix that publishes: the review publishes.
4. Validate again per [engine](../references/engine.md), and repeat until only these remain:
   - errors the [engine](../references/engine.md) says are about the code
   - `warning` lines, which are not errors
5. Look at every element the change reached per [look](../references/look.md), and fix it.
   - A change reaches each record `bump` lists in `changed`.
   - Hand back only when all are looked at.
6. Write the showcase per [engine](../references/engine.md), in the project memory's language.
7. Reply with:
   - the elements and screens created or raised, by title
   - the ones the raise left, for a change
   - an error left, in plain words, never a warning count
   - the `code` files listed, still holding old values, for a change
   - that the code is untouched
   - that each element created or raised is `proposed` until its review
   - the single next step: dress each wireframe as a screen

## Output

The reply to the user.
