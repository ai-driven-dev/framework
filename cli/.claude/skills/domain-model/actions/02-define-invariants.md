# 02 - Define Invariants

Encode the type's fields, validation rules, and construction contract based on the shape chosen in 01.

## Inputs

- `shape` (required) - string, one of `value-object`, `discriminant-union`, `aggregate`
- `concept` (required) - string, concept name and field list

## Outputs

```typescript
// value-object example
export class Widget {
  readonly id: string;
  readonly mode: WidgetMode;
  readonly label: string;

  constructor(params: { id: string; mode: WidgetMode; label: string }) {
    if (!params.id) throw new DomainError("Widget id is required");
    this.id = params.id;
    this.mode = params.mode;
    this.label = params.label;
  }

  equals(other: Widget): boolean {
    return this.id === other.id && this.mode === other.mode;
  }
}
```

## Depends on

- `01-choose-shape`

## Process

1. For `value-object`: declare all fields `readonly`. Use a params object when ≥3 constructor parameters (@`references/value-objects.md`). Throw a typed domain error on invalid input. Implement `.equals()` if the type will be compared or stored in collections.
2. For `discriminant-union`: declare a `type Foo = "a" | "b" | "c"` string union. Add a module-level `const FOO_VALUES = ["a", "b", "c"] as const` if iteration is needed. Do NOT add a class.
3. For `aggregate`: declare all fields `readonly`. Expose mutation methods that return `void` and update internal state. Track invariants across child collections. Delegate complex sub-computations to private methods (≤20 lines each per `.claude/rules/06-design-patterns/6-method-size.md`).
4. Use `CONSTANT_CASE` for any literal string or number used more than once at module level.
5. No imports from `application/` or `infrastructure/` — see `.claude/rules/00-architecture/0-hexagonal.md`.

## Test

Run `pnpm typecheck` — exits 0 confirms the type definitions are internally consistent and import-cycle-free.
