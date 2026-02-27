---
id: 001
milestone: M0
title: "Initialize project structure and ESM configuration"
stories: []
points: 0
blockedBy: []
---

# 001: Initialize project structure and ESM configuration

## Context
The AIDD CLI needs a properly configured TypeScript + Node.js ESM project as its foundation. This is the first ticket -- nothing else can start until the project skeleton exists.

## Scope
Create the project root with package.json, tsconfig.json, and the ESM entry point. Install runtime and dev dependencies per ADR-002 budget (commander ^12, @inquirer/prompts ^7).

## Acceptance Criteria
- [ ] `package.json` exists with `"type": "module"`, Node >= 24 engine, pnpm >= 9 packageManager
- [ ] `tsconfig.json` targets ESNext with NodeNext module resolution, strict mode enabled
- [ ] Runtime dependencies: commander ^12, @inquirer/prompts ^7 (ADR-002 budget fully consumed)
- [ ] Dev dependencies: typescript ^5.x, tsup, vitest, @biomejs/biome
- [ ] `pnpm install` completes without errors
- [ ] `src/index.ts` exists and exports nothing (placeholder)
- [ ] `src/cli.ts` exists with a minimal commander program that responds to `--version`
- [ ] ESM imports work end-to-end (verified by a smoke test)

## Technical Notes
- ADR-002: Exactly 2 runtime dependencies (commander, @inquirer/prompts). No room for a third.
- Naming: kebab-case files, camelCase functions, PascalCase types (architecture.md conventions).
- `"type": "module"` in package.json is mandatory for ESM.
- tsconfig paths should alias `@/` to `src/` for clean imports.

## Files to Create/Modify
- `package.json` -- project metadata, scripts, dependencies
- `tsconfig.json` -- TypeScript configuration
- `src/index.ts` -- library entry point (empty export)
- `src/cli.ts` -- CLI entry point with commander skeleton

## Tests
- Smoke test: import `src/index.ts` without error
- `src/cli.ts` responds to `--version` flag

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
