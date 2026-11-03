# 02 - Write

Write what the state and the request need, in this order.

## Input

The state, the task folder, and the agreed impact if any.

## Process

1. Existing code: read it per the [extraction](../references/extraction.md), which says what each step below takes from it.
2. A change: before touching a token or an element, run `bump` with the task folder, the change, the agreed refs and `--breaking` per [versions](../references/versions.md).
3. No `system.md`: write `brand.md` and `system.md` from the [brand](../assets/brand.md) and [system](../assets/system.md) templates, proposing the answers the code gives.
4. Tokens:
   - existing code: run `extract`, settle its `left` list per [extraction](../references/extraction.md);
   - blank, or a changed token: write them per [tokens](../references/tokens.md);
   - then run `tokens` until it exits 0.
5. Elements asked or extracted: write each record and its render together, per [elements](../references/elements.md), from the [component](../assets/component.md), [asset](../assets/asset.md) and [render](../assets/render.html) templates.
6. A change: rewrite only the renders whose markup changes.
7. After each write, fix what the hook or `validate` reports, except what the [engine](../references/engine.md) says a later step owes.
8. Read [conclude](03-conclude.md).

## Output

The records, tokens, `tokens.css` and renders written, the versions raised.
