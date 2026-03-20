---
paths:
  - "src/domain/models/**/*.ts"
---

# Value Object

## Immutability

- All fields `readonly`
- No setters — return new instance for mutations

## Construction

- Validate invariants in constructor, throw on invalid input
- Use a params object when ≥3 constructor parameters
- Static factory only when multiple distinct creation paths exist

## Equality

- Implement `.equals()` when used in comparisons or collections
- Never rely on reference equality

## Constants

- Module-level `const` in `CONSTANT_CASE` above the class definition
- Named constant for any literal used more than once
