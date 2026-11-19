# 02 - Write

Write what the case needs, in this order.

## Input

The output of [prepare](01-prepare.md).

## Process

1. From the code, [read it](../references/extraction.md).
2. If the user asks for variants, propose and choose per [variants](../references/variants.md).
   - Compare the set per [engine](../references/engine.md).
   - Give the user the page. Ask them to paste the copied feedback here.
   - Wait for the feedback.
     - Read a comment against the tokens it names.
     - Keep: a candidate as it is. Discard: out.
     - Revise: a lead. Its comment says what to change.
     - Several kept: keep the one nearer the brand.
     - Only revise: revise per the comments, then compare again.
   - Keep the chosen variant per [engine](../references/engine.md).
3. If no `system.md` exists, write `aidd_docs/ui/system.md` from the [system](../assets/system-template.md) template.
   - Code: answer from step 1's reading.
   - Ask what [extraction](../references/extraction.md) names no source for.
   - Scratch: ask the user for each answer.
4. With a token file in the code, extract its tokens per [engine](../references/engine.md).
   - Settle what is left per [extraction](../references/extraction.md).
5. For a change, raise the versions per [versions](../references/versions.md).
6. Write the tokens not extracted, new or changed.
   - Follow [tokens](../references/tokens.md) and the brand direction.
7. Generate the stylesheet until nothing blocks, per [engine](../references/engine.md).
8. If this run created `system`, record it per [engine](../references/engine.md).
9. Read [conclude](03-conclude.md).

## Output

- The files written.
- For a change, the raised versions and the agreed impact.
