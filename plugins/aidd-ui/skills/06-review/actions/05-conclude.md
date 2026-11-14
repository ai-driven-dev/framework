# 05 - Conclude

Publish what is all OK, and tell the user what follows.

## Input

The review written.

## Process

1. Take each record with every state ok.
   - The engine publishes it per [engine](../references/engine.md).
   - If it refuses for a capture, keep the record `proposed`.
2. Validate per [engine](../references/engine.md).
3. Fix each error line under `aidd_docs/ui/` as its `=> fix` says.
4. Validate again per [engine](../references/engine.md), and repeat until only these remain:
   - errors the [engine](../references/engine.md) says are about the code
   - `warning` lines, which are not errors
5. Rework each sent-back record now, without asking. Its comment is the request.
6. Write the showcase per [engine](../references/engine.md), in the project memory's language.
7. Reply in a few short lines, never a recap of the verdicts:
   - what changed, by title
   - what to look at, ending with « la vitrine »
   - the captures the user still saves, by screen and state
   - an error left, in plain words, never a warning count
   - the single next step: look again, else the next missing part

## Output

The reply to the user.
