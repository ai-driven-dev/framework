# 02 - Write

Write what the state and the request need, in this order.

## Input

The state, the task folder, and the agreed impact if any.

## Process

1. Without `system.md`: write `brand.md` and `system.md` from the [brand](../assets/brand.md) and [system](../assets/system.md) templates.
   - Existing code: read it per the [extraction](../references/extraction.md) and propose the answers it gives.
2. Write or change the tokens per [tokens](../references/tokens.md), then run `tokens` until it exits 0.
3. Write each element asked or extracted, its record and its render together, and for a change only the renders whose markup changes, per [elements](../references/elements.md), from the [component](../assets/component.md), [asset](../assets/asset.md) and [render](../assets/render.html) templates.
4. For a change, set each reached element's version per [versions](../references/versions.md).
5. After each write, fix what the hook or `validate` reports, except what the [engine](../references/engine.md) says a later step owes.
6. Read [conclude](03-conclude.md).

## Output

The records, tokens, `tokens.css` and renders written.
