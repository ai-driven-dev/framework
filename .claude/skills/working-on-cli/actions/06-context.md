# Create, split or move a context

Load `references/architecture.md` and the `references/contexts/<ctx>.md` of each context involved.

1. Say the reason to change in one sentence. If it needs "and", it is two contexts.
2. Freeze behaviour first with characterization tests, each seen red. Move before rename, rename before any logic change.
3. Create `src/contexts/<ctx>/` with `glossary.md`, `contract/`, `domain/`, `ports/`, `application/`, `infrastructure/`, and `tests/contexts/<ctx>/` mirroring it plus `testing/` and `ports/`. Layout: `references/architecture.md`.
4. A new edge between contexts is a row of `ALLOWED` in `tests/architecture/allowed-edges.ts`; add the context to `HELD_BY_BIOME` there, then run `pnpm biome:boundaries` to regenerate the `biome.json` overrides. Prefer a narrow port in the consumer's `ports/` over a new edge.
5. Add `src/composition/<ctx>.ts`, one module per context, called by `container.ts`.
6. Update the files that name paths: `mutation-scopes.json` and its `test:mutation:<ctx>` script in `package.json`, the coverage excludes in `vitest.config.ts`, `../scripts/sweep-stale-test-dirs.cjs`, `aidd_docs/memory/codebase-map.md` (`docs-do-not-lie.arch.test.ts` holds the tree).
7. Add `references/contexts/<ctx>.md` to this skill from the shape of the others, and `aidd_docs/memory/internal/<ctx>.md` when the context needs a reader's map.
8. Prove each new rule with a planted tree that violates it, the absent case included, and run the test challenge pass: `references/test/test-challenge-pass.md`.
9. Run `pnpm lint`, `pnpm test:arch`, `pnpm typecheck`, then `pnpm test`.
