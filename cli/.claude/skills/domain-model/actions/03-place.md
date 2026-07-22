# 03 - Place

Pick the canonical file location, add the named export, and verify the placement aligns with existing canonical locations.

## Inputs

- `type-name` (required) - string, the PascalCase name of the type
- `shape` (required) - string, one of `value-object`, `discriminant-union`, `aggregate`

## Outputs

```
Placement:
  file: src/domain/models/<kebab-name>.ts
  export: export class <Name> | export type <Name>
  canonical-location-table: updated? yes | no
```

## Depends on

- `02-define-invariants`

## Process

1. Check `references/discriminant-types.md` canonical location table. If the type is already listed there, use the exact path from the table. If not listed, create `src/domain/models/<kebab-name>.ts`.
2. Add only named exports — no `export default`. Export the class, type, and any module-level constants together at the end of the file block (not as re-exports from another file — see `.claude/rules/01-standards/1-exports.md`).
3. Confirm no barrel file (`index.ts`) is created. Callers import directly from the source file.
4. For a new type: update `references/discriminant-types.md` canonical location table if the type is a discriminant union used in ≥2 use-cases.
5. For a value object or aggregate: ensure the file name matches `<concept-kebab-case>.ts` per `.claude/rules/01-standards/1-naming.md`.

## Test

Run `grep -rn "import.*<TypeName>" src/application/ src/infrastructure/` and confirm all existing imports resolve to the new canonical path, exits 0.
