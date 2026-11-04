# 02 - Write

Write what the case needs, step by step.

## Input

The case, `<engine>`, the task folder, and for a change its agreed impact.

## Process

Run only the steps of the case, in this order:

| Case | Steps |
| --- | --- |
| from scratch | 2, 4, 5, 6 |
| from the code | 1, 2, 3, 5, 6 |
| new elements | 4 if tokens are new, 5, 6 |
| change | 7, then 4 if a token changes, then 5 for the renders whose markup changes, 6 |

1. Read the code per [extraction](../references/extraction.md).
2. Write `aidd_docs/ui/brand.md` and `aidd_docs/ui/system.md` from the [brand](../assets/brand.md) and [system](../assets/system.md) templates. From the code, fill them from its README, package manifest and visible copy, and ask the user to confirm the rest.
3. Run `node <engine> extract`, then settle each entry of its `left` list per [extraction](../references/extraction.md).
4. Write or change the tokens in `aidd_docs/ui/tokens.json` and its context files per [tokens](../references/tokens.md).
5. For each element, write its record and its render together, per [elements](../references/elements.md), from the [component](../assets/component.md), [asset](../assets/asset.md) and [render](../assets/render.html) templates.
6. Run `node <engine> tokens` until it exits 0; it writes `tokens.css` and the resolver.
7. Run `node <engine> bump --task <task folder> --change "<one line>" [--breaking] <agreed refs>`, before touching the tokens or records, `--breaking` per [versions](../references/versions.md).

After each write, fix what the hook reports, or what `node <engine> validate` reports without a hook, except what [engine](../references/engine.md) says a later step owes.

Then read [conclude](03-conclude.md).

## Output

The files written, and `bump`'s JSON for a change.
