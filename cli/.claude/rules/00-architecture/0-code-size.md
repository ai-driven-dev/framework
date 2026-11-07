---
description: Apply when code grows; size limits for folders, files, functions, parameters and classes.
paths:
  - "src/**/*.ts"
---

# Code Size

- Ten direct `.ts` files per directory (`folder-size.arch.test.ts`).
- Past that, helpers get written twice.
- Baseline an oversize directory with its count and reason.
- An entry leaves when the defect is fixed.
- Never shuffle files to satisfy a number.
- File: at most 400 non-blank lines, one class.
- Function: at most 50 non-blank lines, cognitive complexity at most 15.
- Parameters: a function or method takes at most 3; beyond that, one named object. A constructor takes at most 5 dependencies.
- Held by `cli/biome.json` on `src/**` (four Biome rules, two plugins in `biome-plugins/`); `code-size.arch.test.ts` proves each bites and that the baseline only shrinks.
- The baseline is each guard's negated includes; an entry leaves when its file is fixed; never add one.
- `tests/**` is outside these limits.
