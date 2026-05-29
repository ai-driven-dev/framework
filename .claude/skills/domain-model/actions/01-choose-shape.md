# 01 - Choose Shape

Decide which domain construct to use before writing any code: value object, discriminant union, or aggregate root.

## Inputs

- `concept` (required) - string, the domain concept name and a one-sentence description of what it represents

## Outputs

```
Shape decision:
  kind: value-object | discriminant-union | aggregate
  rationale: <one sentence>
  target-file: src/domain/models/<kebab-name>.ts
```

## Process

1. Read `references/value-objects.md`. If the concept has fields, invariants, and equality semantics → choose `value-object`.
2. Read `references/discriminant-types.md`. If the concept is a string union used in ≥2 use-cases → choose `discriminant-union`.
3. If the concept tracks mutable state, has an identity, and owns related child collections → choose `aggregate`.
4. Confirm the target file does not already exist. If it does, use the existing file and skip 01 in future actions.
5. Output the shape decision.

## Test

Run `pnpm typecheck` — exits 0 confirms no new import cycles were introduced by the target file location decision.
