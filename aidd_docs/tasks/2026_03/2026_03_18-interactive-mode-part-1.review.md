# Code Review — Interactive Mode Part 1

## Summary

The change correctly centralises prompter instantiation in `deps.ts` and wires it through `restore.ts` and `config.ts`. The new `ConflictResolutionUseCase` and `FileSystem.backup()` port are clean additions. Two critical issues remain: a double-backup bug and an incomplete migration of `update.ts`.

## Issues

### Critical (must fix before merge)

- [src/application/use-cases/conflict-resolution-use-case.ts:44,58 + src/application/use-cases/update-use-case.ts:277] **Double-backup bug.** `ConflictResolutionUseCase.execute()` calls `fs.backup()` for each conflict (lines 44 and 58) and then sets the result to `"backup"`. `UpdateUseCase.applyDiff()` reads `decision === "backup"` and calls `fs.backup()` a second time (line 277). Every conflicting file is backed up twice. The fix is to remove the `fs.backup()` calls from `ConflictResolutionUseCase` — it must only decide, not act. `applyDiff` is already the sole executor.

- [src/application/commands/update.ts:4-6,66-68] **Hexagonal architecture violation: `update.ts` still imports and instantiates infrastructure adapters directly.** `restore.ts` was correctly migrated to `deps.prompter`, but `update.ts` was not. Lines 4-6 import `InquirerPrompterAdapter` and `SilentPrompterAdapter` from infrastructure. Lines 66-68 instantiate them based on `--force`. The `--force` behaviour for updates is already handled entirely by the `force` parameter passed to `resolveConflicts()` in `UpdateUseCase` (lines 241-244), so the adapter switch in the command layer is both a layering violation and dead logic. Fix: remove the adapter imports and use `deps.prompter` as `restore.ts` does.

### Minor (should fix)

- [tests/application/use-cases/helpers.ts:59-135] **`SkipPrompter` and `BackupPrompter` use a positional `callCount` field to steer responses.** This couples the test helper to the internal call order of `ConflictResolutionUseCase`. If the call sequence changes, the helpers silently return wrong values. Use the dedicated `buildMockPrompter` pattern (already in `conflict-resolution-use-case.test.ts`) instead — queue-based responses are explicit and order-independent.

- [tests/application/use-cases/helpers.ts:59,99] **Unused `private callCount = 0` declared in `SkipPrompter` and `BackupPrompter`.** `callCount` is only read inside `select()` but is never reset between test runs, which makes test helpers stateful across calls within a single test. Since the classes are instantiated fresh per test this is harmless today, but the coupling is fragile. Removing `callCount` in favour of a queue makes intent explicit.

### Suggestions (optional)

- [src/application/use-cases/conflict-resolution-use-case.ts] Consider renaming the return type alias `ConflictResolution` to something like `ConflictDecision` to distinguish it from the use case's own class name, reducing cognitive load when reading the file.

- [src/infrastructure/adapters/prompter-adapter.ts:71] The `disabled` mapping `c.disabled ? "Disabled" : false` passes the string `"Disabled"` to `@inquirer/prompts`. Check that this matches the library's expected type; passing `false` vs `undefined` may behave differently.

## Verdict

APPROVED WITH FIXES
