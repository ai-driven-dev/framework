# 02 - Write

Write what the case needs, in this order.

## Input

The case, `<engine>`, the brand's direction, the task folder, and for a change its agreed impact.

## Process

1. From the code: read it per [extraction](../references/extraction.md).
2. No `system.md`: write `aidd_docs/ui/system.md` from the [system](../assets/system-template.md) template; from the code, take the answers from its README, package manifest and visible copy and ask the user to confirm them; from scratch, ask the user for each.
3. From the code, with a token file in `code-tokens`: run `node <engine> extract`, then settle each entry of its `left` list per [extraction](../references/extraction.md).
4. Change: run `node <engine> bump --task <task folder> --change "<one line>" [--breaking] <agreed refs>`, `--breaking` per [versions](../references/versions.md).
5. Tokens not extracted, new or changed: write them in `aidd_docs/ui/tokens.json` and its context files per [tokens](../references/tokens.md), following the brand's direction.
6. Run `node <engine> tokens` until it exits 0; a blocker [engine](../references/engine.md) says a later step owes leaves it exiting 1.
7. `system` created by this run: run `node <engine> bump --task <task folder> --created system`.
8. Read [conclude](03-conclude.md).

## Output

The files written, and for a change `bump`'s JSON and the agreed impact.
