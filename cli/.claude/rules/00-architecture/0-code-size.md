---
description: Apply when code grows; size limits for folders, files, functions, parameters and classes.
paths:
  - "src/**/*.ts"
---

# Code Size

- Ten direct `.ts` files per directory (`folder-size.arch.test.ts`).
- Past that, helpers get written twice.
- A directory over it is baselined with its count and reason; the entry leaves when the defect is fixed.
- Never shuffle files to satisfy a number.
- File: at most 400 non-blank lines, one class.
- Function: at most 50 non-blank lines, cognitive complexity at most 15.
- Parameters: a function or method takes at most 3; beyond that, one named object. A constructor takes at most 5 dependencies.
- Held by `cli/biome.json` on `src/**` (four Biome rules, two plugins in `biome-plugins/`); `code-size.arch.test.ts` proves each bites and that the baseline only shrinks.
- Each of the six Biome guards keeps their baseline as negated includes in their own `biome.json` override. An entry leaves when its file is fixed; never add one. `code-size.arch.test.ts` holds each list to a ceiling it lowers and never raises.
- Written limits, none guarded by a tool:
  - Suppressing these rule ids (`biome-ignore` on a size rule or on `lint/plugin`) is forbidden; none exists in `src/` today.
  - `noExcessiveLinesPerFunction` does not measure getters.
  - A construct signature (`new (...) => T`) is capped at 3 by the function plugin, not 5.
  - Overloads count once per signature.
- `tests/**` is outside these limits.
