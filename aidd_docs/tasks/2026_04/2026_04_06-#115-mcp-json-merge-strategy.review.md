---
name: code-review
description: Code review checklist and scoring template
---

# Code Review for fix(update): .mcp.json merge strategy — user-prime

Replace boolean `shouldMerge` on `ConfigHandler` with typed `mergeStrategy: MergeStrategy`, propagate through the stack, invert `deepMerge` direction for `"user-prime"`. Affects 10 source files + 5 test files.

- Status: needs-fix
- Confidence: 9/10

---

## Main expected Changes

- [x] New `MergeStrategy` discriminant type in `src/domain/models/merge-strategy.ts`
- [x] `ConfigHandler.shouldMerge` → `mergeStrategy` on interface and 4 tool configs
- [x] `GeneratedFile.merge: boolean` → `mergeStrategy: MergeStrategy`
- [x] `distribution.ts` passes strategy through `collectRawFiles`
- [x] `FileSystem` port + adapter: `mergeJsonFile` accepts strategy, inverts `deepMerge` for `user-prime`
- [x] `update-use-case.ts` and `install-use-case.ts`: 3 usages updated
- [x] Tests updated + new tests for `user-prime` and `framework-prime` behaviors

## Scoring

- [🟡] **Import order** `src/domain/models/distribution.ts:4` — `./merge-strategy.js` is placed before `./framework-descriptor.js` but alphabetically `f` < `m` — biome will fail on commit (`biome check --write` will reorder)
- [🟡] **Test names** `tests/domain/tools/opencode.unit.test.ts:203,207` — `"returns framework-prime for ..."` starts with banned verb "returns" and uses hyphens as separators — inconsistent with the behavioral naming applied in `claude.unit.test.ts`

## Code Quality Checklist

### Potentially Unnecessary Elements

- [x] No dead code introduced
- [x] `as const` on stub `mergeStrategy: () => "none" as const` — necessary for TypeScript literal type inference, not removable

### Standards Compliance

- [x] Naming conventions followed (`MergeStrategy`, `mergeStrategy`, `"none" | "framework-prime" | "user-prime"`)
- [x] `import type` used for all type-only imports
- [x] `.js` extensions on all relative imports
- [x] Named exports only, no default exports
- [🟡] Import order — `distribution.ts:4` (see above)

### Architecture

- [x] `MergeStrategy` correctly placed in `src/domain/models/` as discriminant type shared across ≥2 use-cases
- [x] No tool-specific logic leaked into use-cases — strategy flows through `GeneratedFile`
- [x] Port `FileSystem.mergeJsonFile` uses domain vocabulary, not implementation detail
- [x] Adapter `file-system-adapter.ts` contains only I/O + format translation, zero business logic
- [x] Domain models (`generated-file.ts`, `distribution.ts`) do not import from application or infrastructure

### Code Health

- [x] All methods ≤ 20 lines
- [x] Guard clauses used in `mergeStrategy` implementations (fail-fast pattern)
- [x] No magic strings — `"user-prime"` / `"framework-prime"` / `"none"` are the type literals, used directly and correctly
- [x] `deepMerge` direction inversion is minimal and readable (ternary, 3 lines)

### Security

- [x] No new attack surface introduced
- [x] No user input used in file paths beyond existing patterns

### Error management

- [x] `mergeJsonFile` preserves the existing `ENOENT` guard — missing file is handled, other errors are re-thrown

### Performance

- [x] No performance regression — same `deepMerge` function, one ternary branch added

### Frontend specific

N/A

### Backend specific

#### Logging

- [x] No new I/O paths without existing logging patterns

## Final Review

- **Score**: 8.5/10
- **Feedback**: Solid implementation. Two minor issues: import order violation (auto-fixable by biome) and two test name regressions in `opencode.unit.test.ts` (should match the behavioral naming style applied in `claude.unit.test.ts`).
- **Follow-up Actions**:
  1. Fix import order in `distribution.ts` — run `biome check --write src/domain/models/distribution.ts`
  2. Rename opencode test names at lines 203 and 207 to behavioral descriptions (no "returns", no hyphens as separators)
- **Additional Notes**: The `user-prime` MCP merge scenario (issue #115 core) is correctly implemented and tested. `copilot` and `cursor` also benefit from the fix with their respective MCP files.
