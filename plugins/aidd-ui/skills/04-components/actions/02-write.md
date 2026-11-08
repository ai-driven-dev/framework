# 02 - Write

Write what the case needs, in this order.

## Input

The output of [prepare](01-prepare.md).

## Process

1. From the code, read it per [extraction](../references/extraction.md).
2. For a change, raise the versions per [versions](../references/versions.md), removals included.
3. For each element new, extracted, or reached by a change:
   - Write its record per [elements](../references/elements.md), from the [component](../assets/component-template.md) or [asset](../assets/asset-template.md) template.
   - Write its render when new or its markup changes.
   - Use the [render](../assets/render-template.html) template.
   - A value change rewrites no render: renders read `tokens.css`.
   - Deprecate per [versions](../references/versions.md).
4. Generate the stylesheet until nothing blocks, per [engine](../references/engine.md).
5. Record in the history each element this run created, per [engine](../references/engine.md).
6. Read [conclude](03-conclude.md).

## Output

- The files written.
- For a change, the raised versions and the agreed impact.
