---
description: Apply when adding or moving a module; keeps the import chain one-way and shared free of business logic.
paths:
  - "src/**/*.ts"
---

# Contexts

Organise by bounded context, never by layer.

## Chain

- Allowed edges live in `tests/architecture/helpers.ts` (`ALLOWED`).
- Arrows run one way, toward `shared/`.
- `presentation` depends on any context.
- A context depending on either is `BASELINE` debt; it only shrinks.
- `composition/` wires any context; only the composition root imports it.
- `context-graph.arch.test.ts` fails any other edge.
- `biome-context-parity.arch.test.ts` holds `biome.json` to the same data.

## Shared

- `shared/domain/` is the vocabulary two or more contexts speak: tool identity, source, paths, files, merge strategies, errors. It imports no context and no layer above it.
- A new typed error goes into `shared/domain/errors.ts`.
- A technology port two contexts need goes to `shared/ports/`, its adapter to `shared/infrastructure/`, which only the composition root imports.
- A domain decision is never shared material.

## Interior

- Import only a module listed in `PUBLIC_MODULES` (`context-boundary.arch.test.ts`).
- A migrated context (`HELD_BY_BIOME`, `tests/architecture/helpers.ts`) publishes `contract/` and `application/` instead, held by `biome.json`: `reference-context.md`.
- Everything else is internal.
- Never leave a context to re-enter it (`context-self-reentry.arch.test.ts`).

## Adding

- Pick the owning context first.
- A use case fitting nowhere means the contexts are wrong.
- Cross through the target's public module, in the allowed direction.
- Wrong direction: the caller sits in the wrong context.
- Placement is `aidd_docs/memory/codebase-map.md`, held by `codebase-map.arch.test.ts`.
