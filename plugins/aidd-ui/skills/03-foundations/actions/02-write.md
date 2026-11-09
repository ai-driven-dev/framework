# 02 - Write

Write what the case needs, in this order.

## Input

The output of [prepare](01-prepare.md).

## Process

1. From the code, read it per [extraction](../references/extraction.md).
2. If no `system.md` exists, write `aidd_docs/ui/system.md` from the [system](../assets/system-template.md) template.
   - Code: answer from step 1's reading.
   - Ask what [extraction](../references/extraction.md) names no source for.
   - Scratch: ask the user for each answer.
3. With a token file in the code, extract its tokens per [engine](../references/engine.md).
   - Settle what is left per [extraction](../references/extraction.md).
4. For a change, raise the versions per [versions](../references/versions.md).
5. Write the tokens not extracted, new or changed.
   - Follow [tokens](../references/tokens.md) and the brand direction.
6. Generate the stylesheet until nothing blocks, per [engine](../references/engine.md).
7. If this run created `system`, record it per [engine](../references/engine.md).
8. Read [conclude](03-conclude.md).

## Output

- The files written.
- For a change, the raised versions and the agreed impact.
