# 02 - Write

Write what the case needs, in this order.

## Input

The output of [prepare](01-prepare.md).

## Process

1. From the code, read it per [extraction](../references/extraction.md).
2. If no `system.md` exists, write `aidd_docs/ui/system.md` from the [system](../assets/system-template.md) template.
   - Code: read its README, package manifest and visible copy.
   - Code: ask the user to confirm.
   - Scratch: ask the user for each answer.
3. From the code, with a token file in `code-tokens`:
   - Run `node <engine> extract`.
   - Settle each entry of its `left` list per [extraction](../references/extraction.md).
4. For a change, run the command below, `--breaking` per [versions](../references/versions.md):

   ```
   node <engine> bump --task <task folder> --change "<one line>" [--breaking] <agreed refs>
   ```

5. Write the tokens not extracted, new or changed:
   - In `aidd_docs/ui/tokens.json` and its context files.
   - Per [tokens](../references/tokens.md), following the brand direction.
6. Run `node <engine> tokens` until it exits 0.
   - Exit 1 stays for a blocker [engine](../references/engine.md) says a later step owes.
7. If this run created `system`:
   - Run `node <engine> bump --task <task folder> --created system`.
8. Read [conclude](03-conclude.md).

## Output

- The files written.
- For a change, `bump`'s JSON and the agreed impact.
