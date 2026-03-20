# Code Review — Interactive Mode Part 2

## Summary

Part 1 fixes (double-backup bug, `update.ts` architecture violation) are confirmed applied and correct. Part 2 adds interactive fallback to `install`, `uninstall`, and `adopt` commands. The architecture is sound: TTY checks live in the command layer, `deps.prompter` is used throughout, no adapter imports in command files. Two fixes were applied during this review.

## Issues

### Critical

None found.

### Minor

- **[install.ts:57,87] Double manifest load (fixed).** The interactive path loaded the manifest at line 57 to get installed tool IDs, then the code unconditionally loaded it again at line 87 to get `docsDir`. The second load shadowed and discarded the first result. Fixed by hoisting the single `deps.manifestRepo.load()` call before the tool-selection branch, reusing the result in both the interactive path and the manifest-null guard.

- **[tests/application/use-cases/helpers.ts] `SkipPrompter` and `BackupPrompter` duplicated `select()`, `checkbox()`, `confirm()`, `input()` verbatim (fixed).** The two classes differed only in their `selectQueue` values and their `resolveConflict()` return value. Extracted `QueuedSelectPrompter` abstract base class with constructor-injected `selectQueue`. Both prompters now extend it, implementing only `resolveConflict()`. Eliminates ~40 lines of duplication.

- **[install.ts:72-74, uninstall.ts:64-67] `output.error()` on empty user selection.** The CLI output rule states: conflicts and skips use `warn`, not `error`. A user pressing Enter without selecting anything is an abort, not an error condition. Should use `output.warn("No tools selected.")` followed by `return` instead of `process.exit(1)`. Not fixed — this is a product decision (exit code 1 on abort vs 0); flagging for discussion.

- **[adopt.ts:49,72] Two TTY checks for one command.** `adopt` has one TTY check at line 49 (tools missing) and a second at line 72 (version missing). The second uses `throw` (correct — inside try-catch), the first uses `process.exit(1)` (inconsistent). The first should also throw so the catch block handles it uniformly. Not fixed — minor inconsistency, no functional impact.

- **[helpers.ts:22] `SilentPrompterAdapter` aliased as `OverwritePrompter` is semantically misleading.** The alias name implies a fixed "overwrite" decision, but `SilentPrompterAdapter.select()` returns the first non-disabled choice — correct by coincidence today because `"global"` then `"overwrite all"` are the first choices in `ConflictResolutionUseCase`. If choice order changes, update tests break silently. A dedicated `OverwritePrompter` class with an explicit `selectQueue` of `["global", "overwrite all"]` (like `SkipPrompter` and `BackupPrompter`) would make intent explicit. Not fixed — requires assessing impact on all tests using `OverwritePrompter`.

### Suggestions

- **[conflict-resolution-use-case.test.ts] Test input paths are absolute** (`/project/a.md`) but the parameter is named `relativePaths`. Using relative paths (e.g. `a.md`, `b.md`) would match the declared contract and avoid confusion.

- **[install.ts, uninstall.ts, adopt.ts] TTY check pattern is not extracted.** Each command repeats `if (!process.stdout.isTTY) { output.error(...); process.exit(1); }`. A shared helper (e.g. `requireTTY(output, message)`) would centralize this. Acceptable for now given the small number of callsites, but worth extracting when Part 3–4 add more commands.

## Verdict

APPROVED WITH FIXES — two fixes applied (double manifest load in `install.ts`, duplicated prompter code in `helpers.ts`). All 716 tests pass, typecheck clean, lint clean.
