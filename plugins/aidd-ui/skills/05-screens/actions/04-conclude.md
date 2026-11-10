# 04 - Conclude

Leave screens that validate, and tell the user what follows.

## Input

The screens kept.

## Process

1. Record in the history each screen kept, per [engine](../references/engine.md).
2. Validate per [engine](../references/engine.md).
3. Fix each error line under `aidd_docs/ui/` as its `=> fix` says.
4. Validate again per [engine](../references/engine.md), and repeat until only these remain:
   - errors the [engine](../references/engine.md) says are about the code
   - `warning` lines, which are not errors
5. Reply with:
   - the screens created, each with the wireframe it dresses
   - what the validation still prints
   - that the code is untouched
   - that each screen is `proposed` until its review

## Output

The reply to the user.
