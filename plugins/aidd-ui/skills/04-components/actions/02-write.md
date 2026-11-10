# 02 - Write

Write what the case needs, in this order.

## Input

The output of [prepare](01-prepare.md).

## Process

1. From the code, [read it](../references/extraction.md).
2. For a change, raise the versions per [versions](../references/versions.md), removals included.
3. If the user asks for variants of an element, propose and choose.
   - Follow [variants](../references/variants.md).
   - Compare the set per [engine](../references/engine.md).
   - Give the user the page, and say how to return the feedback.
   - Wait for the feedback.
     - Read the feedback file beside the page. Else write the pasted feedback there.
     - Read a comment against the state it names.
     - Where ratings tie, prefer the one with fewer states to maintain.
   - Keep the chosen variant per [engine](../references/engine.md).
4. For each element new, extracted, or reached by a change:
   - Skip one already kept above.
   - Write its record per [elements](../references/elements.md), from the [component](../assets/component-template.md) or [asset](../assets/asset-template.md) template.
   - Write its render when new or its markup changes.
   - Use the [render](../assets/render-template.html) template.
   - A value change rewrites no render: renders read `tokens.css`.
   - [Deprecate](../references/versions.md) it.
5. Generate the stylesheet until nothing blocks, per [engine](../references/engine.md).
6. Record in the history each element this run created, per [engine](../references/engine.md).
7. Read [conclude](03-conclude.md).

## Output

- The files written.
- For a change, the raised versions and the agreed impact.
