# Reference: Value Objects

## Rules

- All fields `readonly` — no setters
- Return a new instance for mutations — never mutate in place
- Validate invariants in the constructor; throw a typed domain error on invalid input
- Use a params object when ≥3 constructor parameters
- Add a static factory only when there are multiple distinct creation paths
- Implement `.equals()` when the type will be compared or stored in collections

## Module-level constants

- `CONSTANT_CASE` for any string or number literal used more than once
- Place constants above the class definition in the same file

## Import rules

- `src/domain/models/` files must not import from `src/application/` or `src/infrastructure/`
- Cross-domain imports within `src/domain/models/` are allowed

## Agnostic shape example

```typescript
export class Widget {
  readonly id: string;
  readonly label: string;
  readonly mode: WidgetMode;

  constructor(params: { id: string; label: string; mode: WidgetMode }) {
    if (!params.id) throw new DomainError("Widget id is required");
    if (!params.label) throw new DomainError("Widget label is required");
    this.id = params.id;
    this.label = params.label;
    this.mode = params.mode;
  }

  equals(other: Widget): boolean {
    return this.id === other.id && this.mode === other.mode;
  }

  withLabel(label: string): Widget {
    return new Widget({ id: this.id, label, mode: this.mode });
  }
}
```
