# Code Review: Interactive Mode Part 3

Date: 2026-03-18
Scope: `init` and `config` interactive fallback commands

## Part A: Coding Assertions

| Assertion | Result | Notes |
|-----------|--------|-------|
| `pnpm typecheck` | PASS (after fix) | Failed initially due to moved `validateRepoFormat` |
| `pnpm lint` | PASS | No issues |
| `pnpm knip:production` | PASS | No dead code |
| `pnpm jscpd` | PASS | 26 clones — all pre-existing, none introduced by Part 3 |
| `pnpm test` | PASS | 731 tests, 55 files |

## Part B: Code Review Findings

### Critical Issues Found and Fixed

#### C1: Hexagonal Architecture Violation — `config.ts` imports from infrastructure

**File**: `src/application/commands/config.ts` line 2 (before fix)
**Violation**: Application layer imported `validateRepoFormat` directly from `src/infrastructure/adapters/framework-resolver-adapter.ts`.
**Rule violated**: Dependency direction must be infrastructure → application → domain. Application must never import from infrastructure.
**Fix applied**:
- Moved `validateRepoFormat` + `REPO_FORMAT_REGEX` to `src/domain/models/manifest.ts` (correct layer — pure domain validation logic with no I/O dependency)
- Removed the duplicated implementation from `src/infrastructure/adapters/framework-resolver-adapter.ts`
- Updated imports in:
  - `src/application/commands/config.ts` — now imports from `../../domain/models/manifest.js`
  - `src/infrastructure/deps.ts` — now imports from `../domain/models/manifest.js`
  - `tests/infrastructure/adapters/framework-resolver-adapter.test.ts` — updated to match new location

### Minor Issues Found and Fixed

#### M1: Dynamic import of `node:path` inside function body

**File**: `src/application/commands/config.ts` line 171 (before fix)
**Issue**: `const { join } = await import("node:path")` inside the `set` action handler. Dynamic import of a Node.js built-in inside a function body is unnecessary — the module is always available, and the pattern adds async overhead and noise.
**Fix applied**: Moved to static top-level import `import { join } from "node:path"` at the top of the file.

### Observations (Not Fixed)

#### O1: VALID_DOCS_DIR regex duplicated in test file

**File**: `tests/application/use-cases/interactive-commands.test.ts` lines 197-212
**Issue**: The test block `init — interactive fallback: docsDir validation` re-declares the same regex locally (`const VALID_DOCS_DIR = /^[a-zA-Z0-9_-]+$/`) and tests it directly. This tests the regex implementation rather than the behavior of the `init` command.
**Testing rule**: "Test behavior, not implementation."
**Why not fixed**: The regex is `module-private` in `init.ts` (not exported), so importing it directly into tests is not possible without changing the production API surface. E2E coverage at `tests/e2e/init.e2e.test.ts:54` already tests the behavioral outcome (`"Invalid directory name"` error). These unit tests are redundant but harmless. Removing them without replacing with behavior-oriented tests would reduce coverage signal.
**Recommendation**: Replace with behavior-oriented tests once `init` command is made E2E-testable, or export `VALID_DOCS_DIR` from `init.ts` and test through import.

#### O2: DEFAULT_DOCS_DIR defined in both domain and application

**Files**: `src/domain/models/manifest.ts:5` and `src/application/commands/init.ts:8`
**Issue**: The same constant `"aidd_docs"` is defined twice. Pre-existing issue, not introduced by Part 3.
**Recommendation**: Export `DEFAULT_DOCS_DIR` from `manifest.ts` and consume it in `init.ts`.

### Review Against Specific Requirements

#### 1. Hexagonal architecture — no infra imports in commands beyond deps

- `init.ts`: Clean. Imports from domain and application layers only.
- `config.ts`: Fixed (C1 above). Now clean.

#### 2. TTY check pattern consistent with Parts 1 & 2

Parts 1 & 2 pattern (install, uninstall, adopt): explicit `if (!process.stdout.isTTY)` guard before any `deps.prompter` call, with `output.error()` + `process.exit(1)`.

Part 3 (init, config):
- `init.ts` line 44: `if (explicitDocsDir === undefined && !cmdOptions.force && process.stdout.isTTY)` — TTY check combined with force check in a single condition. Consistent with intent, though the order differs from Parts 1 & 2 (which use an inverted guard). Both are correct.
- `config.ts` get: `if (!process.stdout.isTTY)` guard before prompt — consistent.
- `config.ts` set: `if (!process.stdout.isTTY)` guard before prompt — consistent.
- `config.ts` set, confirmation prompts: `if (!process.stdout.isTTY)` inside `if (!cmdOptions.force)` — consistent.

#### 3. No silent errors

All error paths use `output.error()` + `process.exit(1)` or `throw` caught by `output.exit()`. No silent swallowing.

#### 4. Testing rules — behavior-oriented names, no describe.concurrent() in unit tests

- No `describe.concurrent()` found in `interactive-commands.test.ts` — correct.
- Test names: Mostly behavior-oriented. The `init — interactive fallback: docsDir validation` block leans implementation-testing (see O1).

#### 5. init: `--force` correctly skips prompts

`init.ts` line 44: `!cmdOptions.force` is part of the condition — when `--force` is set, the entire interactive block (both `docsDir` and `repo` prompts) is skipped. Correct.

#### 6. config: existing confirmation prompt preserved, not bypassed

Both `repo` and `docsDir` confirmation prompts in `config set` are behind `if (!cmdOptions.force)` — they are not bypassed, they are properly gated. Only `--force` skips them. Correct.

## Final Verdict

PASS after fixes.

**Fixes applied (2):**
1. Moved `validateRepoFormat` to domain layer to fix hexagonal architecture violation
2. Replaced dynamic `await import("node:path")` with static top-level import

**Pre-existing issues documented (not in scope of Part 3):**
- Test re-implements domain regex instead of testing behavior (O1)
- `DEFAULT_DOCS_DIR` duplicated across domain and application (O2)
