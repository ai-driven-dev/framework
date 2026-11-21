---
description: Apply to every cast; a value is never widened away from the type it holds.
paths:
  - "src/**/*.ts"
  - "tests/**/*.ts"
---

# Type Honesty

- No widening cast (`as unknown as`, `as any`, `as never`) in `src/` or `tests/`: `CASTS_ALLOWED` in `scripts/check-cli-type-honesty.mjs` lists each surviving cast.
- No `@ts-expect-error` or `@ts-ignore` in `src/`: the same script enforces it.
- A test proving non-compilation may use `@ts-expect-error`.
- `noTsIgnore` in `cli/biome.json` refuses `@ts-ignore` everywhere.
- `scripts/check-cli-type-honesty.mjs` runs from the repository root: it reads `process.cwd()/cli`.
