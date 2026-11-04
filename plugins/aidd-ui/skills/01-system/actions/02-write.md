# 02 - Write

Write what the case needs, step by step.

## Input

The case, `<engine>`, the task folder, and for a change its agreed impact.

## Process

1. Run only the steps of the case, in the order [cases](../references/cases.md) gives.
2. Read the code per [extraction](../references/extraction.md).
3. Write `aidd_docs/ui/brand.md` and `aidd_docs/ui/system.md` from the [brand](../assets/brand-template.md) and [system](../assets/system-template.md) templates. From the code, fill them from its README, package manifest and visible copy, and ask the user to confirm the rest.
4. Run `node <engine> extract`, then settle each entry of its `left` list per [extraction](../references/extraction.md).
5. Write or change the tokens in `aidd_docs/ui/tokens.json` and its context files per [tokens](../references/tokens.md).
6. For each element, write its record and its render together, per [elements](../references/elements.md), from the [component](../assets/component-template.md), [asset](../assets/asset-template.md) and [render](../assets/render-template.html) templates.
7. Run `node <engine> tokens` until it exits 0.
8. Run `node <engine> bump --task <task folder> --change "<one line>" [--breaking] <agreed refs>`, before touching the tokens or records, `--breaking` per [versions](../references/versions.md).
9. Run `node <engine> bump --task <task folder> --created <id>…` with the id of each record written in this run, `system` included, never `brand`.
10. Read [conclude](03-conclude.md).

## Output

The files written, and `bump`'s JSON for a change.
