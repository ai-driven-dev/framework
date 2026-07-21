---
name: domain-model
description: >
  Creates or modifies domain types in src/domain/ — value objects, discriminant unions, and
  aggregate roots. Use when adding a new domain concept, defining invariants for an existing
  type, or placing a shared discriminant union that is used across multiple use-cases. Do NOT
  use for orchestrating I/O or business logic — use `use-case` instead. Do NOT use for
  infrastructure concerns — use `adapter` instead.
---

# Domain Model

Builds and places the typed vocabulary of the application: value objects, discriminant types,
and aggregate roots that live in `src/domain/models/`. The domain layer must never import from
`application/` or `infrastructure/`.

## Available actions

| #   | Action            | Role                                              | Input                                   |
| --- | ----------------- | ------------------------------------------------- | --------------------------------------- |
| 01  | `choose-shape`    | Decide between value object, discriminant type, or aggregate | concept description            |
| 02  | `define-invariants` | Encode readonly fields, validation, factory     | chosen shape from 01                   |
| 03  | `place`           | Pick canonical file location, add named export    | defined type from 02                   |
| 04  | `test`            | Write unit tests for the domain type              | placed type from 03                    |

## Default flow

`01 → 02 → 03 → 04`

## Transversal rules

- All domain types must be free of `application/` and `infrastructure/` imports.
- All fields are `readonly`; return new instances for mutations.
- Never inline a discriminant union used in ≥2 use-cases; place it in `src/domain/models/`.
- Named export only, no default export.
- File name is `kebab-case.ts`.
- Validate invariants in constructor or static factory; throw a typed domain error on invalid input.
- Module-level `const` in `CONSTANT_CASE` for any literal used more than once.

## References

- `references/value-objects.md` — value object conventions (readonly, equals, constructor params)
- `references/discriminant-types.md` — discriminant union placement rules and canonical locations
- `references/manifest.md` — aggregate root conventions for the Manifest model

## Invariant rules

- `references/value-objects.md` — authoritative value object rules
- `references/discriminant-types.md` — authoritative discriminant type rules
