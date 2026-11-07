# 02 - Write

Write what the case needs, in this order.

## Input

The case, `<engine>`, the task folder, and for a change its agreed impact.

## Process

1. From the code: read it per [extraction](../references/extraction.md).
2. Change: run `node <engine> bump --task <task folder> --change "<one line>" [--breaking] <agreed refs>`, `--breaking` per [versions](../references/versions.md); a removal: `--removed <ids>` in place of `--change`, then remove per [versions](../references/versions.md). An element whose row in `history.md` already names this task needs no bump: `bump` leaves it in `left`.
3. Elements new, extracted, or reached by a change: write each record, and its render when new or when its markup changes, per [elements](../references/elements.md), from the [component](../assets/component-template.md), [asset](../assets/asset-template.md) and [render](../assets/render-template.html) templates; a value change rewrites no render, renders reading `tokens.css`. Deprecate per [versions](../references/versions.md).
4. Run `node <engine> tokens` until it exits 0.
5. Records this run created: run `node <engine> bump --task <task folder> --created <id>…`.
6. Read [conclude](03-conclude.md).

## Output

The files written, and for a change `bump`'s JSON and the agreed impact.
