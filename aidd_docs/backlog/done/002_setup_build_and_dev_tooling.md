---
id: 002
milestone: M0
title: "Setup build and dev tooling (tsup, vitest, biome)"
stories: []
points: 0
blockedBy: [001]
---

# 002: Setup build and dev tooling (tsup, vitest, biome)

## Context
The project needs a build pipeline (tsup for bundling), a test runner (vitest), and a linter/formatter (biome). These tools must be configured before any feature code is written.

## Scope
Configure tsup to produce a single ESM bundle with a bin entry. Configure vitest with path aliases. Configure biome for lint + format. Add npm scripts for build, test, lint, typecheck.

## Acceptance Criteria
- [ ] `tsup.config.ts` exists producing `dist/cli.js` as ESM with shebang for bin entry
- [ ] `vitest.config.ts` exists with path aliases matching `src/` structure
- [ ] `biome.json` exists with lint and format rules
- [ ] `pnpm build` produces a working `dist/cli.js`
- [ ] `pnpm test` runs vitest (empty suite, zero failures)
- [ ] `pnpm lint` runs biome check with zero violations
- [ ] `pnpm typecheck` runs `tsc --noEmit` successfully
- [ ] `pnpm format` runs biome format
- [ ] Built `dist/cli.js` is executable and responds to `--version`

## Technical Notes
- tsup: ESM format, target node20, entry `src/cli.ts`, clean output dir.
- vitest: ESM-native, path aliases matching tsconfig paths.
- biome: Replaces eslint+prettier. Single config file.
- package.json `"bin"` field should point to `dist/cli.js`.

## Files to Create/Modify
- `tsup.config.ts` -- build configuration
- `vitest.config.ts` -- test configuration
- `biome.json` -- lint/format configuration
- `package.json` -- add scripts (build, test, lint, typecheck, format), add bin field

## Tests
- `pnpm build && node dist/cli.js --version` outputs version
- `pnpm test` runs without error
- `pnpm lint` passes clean

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
