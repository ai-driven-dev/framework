# 06 - Create, split or move a context

Move behaviour between contexts without changing it, then extend the rules to the new one.

## Input

The context to create, split or move, and its single reason to change.

## Output

A context with its composition module, tests mirror, edges, reference page and passing gates.

## Process

1. **Load.** Read [architecture.md](../references/architecture.md) and the `references/contexts/<ctx>.md` of each context involved.
2. **Reason.** Say the reason to change in one sentence. If it needs "and", it is two contexts.
3. **Freeze.** Freeze behaviour first with characterization tests, each seen red. Move before rename, rename before any logic change.
4. **Create.** Create `src/contexts/<ctx>/` with `glossary.md` and the folders of `architecture.md`, Context shape, and `tests/contexts/<ctx>/` mirroring it plus `testing/` and `ports/`.
5. **Edges.** A new edge between contexts is a row of `ALLOWED` in `tests/architecture/allowed-edges.ts`; add the context to `HELD_BY_BIOME` there, then run `pnpm biome:boundaries` to regenerate the `biome.json` overrides. Prefer a narrow port in the consumer's `ports/` over a new edge.
6. **Compose.** Add `src/composition/<ctx>.ts`, one module per context, called by `container.ts`.
7. **Register.** Update the files that name paths: `mutation-scopes.json` and its `test:mutation:<ctx>` script in `package.json`, the coverage excludes in `vitest.config.ts`, `../scripts/sweep-stale-test-dirs.cjs`, and [codebase-map.md](../../../../cli/aidd_docs/memory/codebase-map.md) (`docs-do-not-lie.arch.test.ts` holds the tree).
8. **Document.** Add `references/contexts/<ctx>.md` to this skill from the shape of the others, and `aidd_docs/memory/internal/<ctx>.md` when the context needs a reader's map.
9. **Prove.** Prove each new rule with a planted tree that violates it, the absent case included, then run the challenge pass ([test-challenge-pass.md](../references/test/test-challenge-pass.md)).
10. **Gate.** Run `pnpm lint`, `pnpm test:arch`, `pnpm typecheck`, then `pnpm test`.

## Test

| Case | Pass |
| --- | --- |
| a planted import outside `ALLOWED` | `pnpm test:arch` fails |
| `pnpm lint && pnpm typecheck && pnpm test` | exit 0 |
| characterization tests before and after the move | green both times |
