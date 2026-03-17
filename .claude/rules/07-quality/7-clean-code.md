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
- `_param` prefix only when interface contract requires it
- No commented-out code

## DRY

- Extract private helper when ≥2 callers share identical logic
- Class methods use own fields, not their literal values

## Magic values

- Named constant for any string or number literal used more than once
- Use `this.field` instead of hardcoding the field's value inline

## Fail fast

- Guard clauses first: `if (!condition) return` or `throw`
- No nested conditionals — flatten with early returns

## KISS

- Simplest solution that satisfies the requirement
- No clever tricks

## Single responsibility

- One reason to change per function, class, and file
- Functions ≤ 20 lines
- Extract private methods or sub-classes for each responsibility
- If it needs a comment to explain "what", split it
