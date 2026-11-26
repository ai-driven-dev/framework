# 02 - Write

Write what the case needs, in this order.

## Input

The output of [prepare](01-prepare.md).

## Process

1. From the code, [read it](../references/extraction.md).
2. If the user asks for variants, propose and choose per [variants](../references/variants.md).
   - Write the showcase per [engine](../references/engine.md), in the language the person writes in.
   - Fix what it reports.
   - Give the user the set's page, and ask them to choose, then paste the copied feedback here.
   - Wait for the feedback.
     - Read the entry with `set`.
     - Leave record entries.
     - Read a comment against the tokens it names.
     - Keep: a candidate as it is.
     - Discard: out.
     - Revise: a lead whose comment says what to change.
     - No verdict: not looked at, so ask before deciding.
     - Several kept: keep the one nearer the brand.
     - Only revise: revise per the comments, then write the showcase again.
   - Keep the chosen variant per [engine](../references/engine.md).
3. If no `system.md` exists, write `aidd_docs/ui/system.md` from the [system](../assets/system-template.md) template.
   - Code: answer from step 1's reading.
   - Ask what [extraction](../references/extraction.md) names no source for.
   - Scratch: ask the user for each answer, but never about sizes.
   - Pick sizes from the platforms: phone and desktop for the web.
   - Ask only if the product needs a third size, and name it by device, such as tablet at a desk.
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
