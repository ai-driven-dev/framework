---
paths:
  - "src/**/*.ts"
  - "tests/**/*.ts"
---

# Clean Code

## YAGNI

- No stub methods for future milestones
- Unimplemented method lives in the ticket that implements it
- Remove placeholder `throw new Error("not yet implemented")` methods immediately

## Dead code

- Remove unused function parameters immediately
- `_param` prefix allowed only when interface contract requires it
- No commented-out code

## DRY

- Extract private helper when ≥2 callers share identical logic
- Class methods use own fields, not their literal values

## Magic strings

- Named constant for any string literal used more than once
- Use `this.field` instead of hardcoding the field's value inline
