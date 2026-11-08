# 03 - Conclude

Leave components that validate, and tell the user what follows.

## Input

The output of [write](02-write.md).

## Process

1. Validate per [engine](../references/engine.md).
2. Fix each error line under `aidd_docs/ui/` as its `=> fix` says.
3. Skip a fix that publishes: validating is the user's.
4. Repeat until only these remain:
   - [code errors](../references/code-errors.md)
   - `warning` lines, which are not errors
5. Reply per [reply](../references/reply.md).

## Output

The reply to the user.
