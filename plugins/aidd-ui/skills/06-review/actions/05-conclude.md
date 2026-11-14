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
5. Write the showcase per [engine](../references/engine.md), in the project memory's language.
6. Reply with:
   - the records published, with their versions
   - the records sent back for change, with their comments
   - the captures the user still saves, with their paths
   - what the validation still prints
   - that the code is untouched
   - the single next step: rework sent-back records, else the next missing part

## Output

The reply to the user.
