---
description: Apply to every cast; a value is never widened away from the type it holds.
paths:
  - "src/**/*.ts"
  - "tests/**/*.ts"
---

# Type Honesty

- No widening cast, and no `@ts-expect-error` or `@ts-ignore` in `src/`: `scripts/check-cli-type-honesty.mjs` enforces both, and its `CASTS_ALLOWED` lists each surviving cast.
