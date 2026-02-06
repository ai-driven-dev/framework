---
name: coding-assertions
description: Code quality verification checklist
---

# Coding Guidelines

> Those rules must be minimal because the MUST be checked after EVERY CODE GENERATION.

## Requirements to complete a feature

**A feature is really completed if ALL of the above are satisfied: if not, iterate to fix all until all are green.**

## Steps to follow

1. Check there is no duplication
2. Ensure code is re-used
3. Run all those commands, in order to ensure code is perfect:

| Order | Command                           | Description                              |
|-------|-----------------------------------|------------------------------------------|
| 1     | `pnpm run typecheck`              | TypeScript strict compilation check      |
| 2     | `pnpm run lint`                   | Biome linter check                       |
| 3     | `pnpm run knip:production`        | Unused code detection (production deps)  |
| 4     | `pnpm run jscpd`                  | Code duplication detection               |
| 5     | `pnpm run format`                 | Biome auto-formatting                    |
| 6     | `pnpm test`                       | Full E2E test suite with build           |
| 7     | `pnpm run build`                  | Production build via tsup                |
| 8     | `lefthook run pre-commit --force` | Run all pre-commit hooks                 |

## Success Criteria

- ✅ All commands above pass without errors
- ✅ No TypeScript errors
- ✅ No linting issues
- ✅ No unused code/dependencies
- ✅ No code duplication
- ✅ Code properly formatted
- ✅ All tests passing
- ✅ Production build successful
- ✅ All hooks passing
