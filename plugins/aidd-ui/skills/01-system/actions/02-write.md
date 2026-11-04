# 02 - Write

Write what the case needs, in this order.

## Input

The case, `<engine>`, the task folder, and for a change its agreed impact.

## Process

1. From the code: read it per [extraction](../references/extraction.md).
2. No `system.md`: write `aidd_docs/ui/brand.md` and `aidd_docs/ui/system.md` from the [brand](../assets/brand-template.md) and [system](../assets/system-template.md) templates; from the code, take the answers from its README, package manifest and visible copy and ask the user to confirm them; from scratch, ask the user for each.
3. From the code, with a token file in `code-tokens`: run `node <engine> extract`, then settle each entry of its `left` list per [extraction](../references/extraction.md).
4. Change: run `node <engine> bump --task <task folder> --change "<one line>" [--breaking] <agreed refs>`, `--breaking` per [versions](../references/versions.md).
5. Tokens not extracted, new or changed: write them in `aidd_docs/ui/tokens.json` and its context files per [tokens](../references/tokens.md).
6. Elements new, extracted, or reached by a change: write each record and its render together, per [elements](../references/elements.md), from the [component](../assets/component-template.md), [asset](../assets/asset-template.md) and [render](../assets/render-template.html) templates; for a change, rewrite only the renders whose markup changes, and deprecate per [versions](../references/versions.md).
7. Run `node <engine> tokens` until it exits 0.
8. Records this run created, `system.md` among them when step 2 ran: run `node <engine> bump --task <task folder> --created <id>…`.
9. Read [conclude](03-conclude.md).

## Output

The files written, and `bump`'s JSON for a change.
