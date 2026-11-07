# 02 - Write

Write what the case needs, in this order.

## Input

The output of [prepare](01-prepare.md).

## Process

1. From the code, read it per [extraction](../references/extraction.md).
2. For a change, run the command below, `--breaking` per [versions](../references/versions.md):

   ```
   node <engine> bump --task <task folder> --change "<one line>" [--breaking] <agreed refs>
   ```

   - A removal uses `--removed <ids>` in place of `--change`.
   - Then remove per [versions](../references/versions.md).
   - An element whose `history.md` row already names this task needs no bump.
   - `bump` leaves it in `left`.
3. For each element new, extracted, or reached by a change:
   - Write its record per [elements](../references/elements.md).
   - Use the [component](../assets/component-template.md) and [asset](../assets/asset-template.md) templates.
   - Write its render when it is new or its markup changes.
   - Use the [render](../assets/render-template.html) template.
   - A value change rewrites no render: renders read `tokens.css`.
   - Deprecate per [versions](../references/versions.md).
4. Run `node <engine> tokens` until it exits 0.
5. For the records this run created:
   - Run `node <engine> bump --task <task folder> --created <id>…`.
6. Read [conclude](03-conclude.md).

## Output

- The files written.
- For a change, `bump`'s JSON and the agreed impact.
