# Code Review for Typed Domain Exceptions + ErrorHandler

Refactored error handling: removed `CLIOutput.exit()`, introduced `ErrorHandler`, replaced all 64 `throw new Error(...)` with typed exceptions across domain/application/infrastructure layers.

- Status: needs-fixes
- Confidence: 7/10

---

- [Main expected Changes](#main-expected-changes)
- [Scoring](#scoring)
- [Code Quality Checklist](#code-quality-checklist)

## Main expected Changes

- [x] `AuthenticationError` added to domain, used in http-client and auth-login
- [x] `ErrorHandler` created in application layer
- [x] `CLIOutput.exit()` removed
- [x] All 13 commands migrated to `errorHandler.handle(error)`
- [x] All 64 `throw new Error(...)` replaced with typed exceptions
- [x] `GhCliError` moved to infrastructure (not leaking in domain)
- [x] 3 architecture rules updated
- [x] Tests: 932/932 pass

## Scoring

### Architecture

- [🟢] Hexagonal dependency direction respected — no infra imports in domain or application error-handler
- [🟢] Rules correctly updated (0-error-handling, 3-cli-output, 6-adapter, 0-command-thin-wrapper)
- [🟢] Infrastructure errors (`GhCliError`, `HttpError`, etc.) stay internal, never cross port boundary

### Code Health

- [🔴] **Message loss on AlreadyInitializedError**: `init-use-case.ts:58` Original message was: `Already initialized (docs in "${existing.docsDir}"). Use \`aidd init --force\` to re-copy docs, or \`aidd clean --force\` to reset completely.` — Now replaced by generic `AlreadyInitializedError()` which says `Already initialized. Use \`aidd update\` to upgrade.` Lost: docsDir context, --force hint, clean option. Two different use-cases (init vs adopt) had different messages but now share the same generic one.
- [🟡] **ErrorHandler.toMessage() — dead instanceof chain**: `error-handler.ts:30-45` Every branch returns `error.message`, identical to the fallback `error instanceof Error ? error.message : String(error)`. The 15-line instanceof chain does nothing. Either remove it (YAGNI) or add a comment explaining the extensibility intent.
- [🟡] **InputRequiredError misuse**: `adopt-use-case.ts:126` `Directory '${config.directory}' not found for tool '${toolId}'` is not "input required" — it's a filesystem state error. Same for `doctor-use-case.ts:81` `Manifest is corrupted (invalid JSON)` — this is a `ManifestValidationError`, not missing input.
- [🟡] **ToolNotInstalledError message inconsistency**: `sync-use-case.ts:257` Original: `Source tool 'cursor' is not installed.` Now: `cursor is not installed` — lost quotes around tool name and "Source tool" prefix. Context is less helpful in sync scenarios.
- [🟡] **ToolValidationError in prompter-adapter**: `prompter-adapter.ts:31` "No enabled choices available" is not a tool validation issue — it's a UI/prompter concern. Should be `InputRequiredError`.

### Error management

- [🟢] Zero `throw new Error(...)` in `src/`
- [🟢] Zero `output.exit()` calls remaining
- [🟢] All commands route through `ErrorHandler.handle()`
- [🟢] `ConfigConflictError` handled via fallback (works, not explicitly listed)

### Standards Compliance

- [🟢] Named exports only
- [🟢] Relative imports with `.js` extension
- [🟢] Biome clean after autofix
- [🟢] Test naming with describe blocks

### Security

- [🟢] No credentials exposed in error messages
- [🟢] Auth token never logged in error paths

### Performance

- [🟢] ErrorHandler is cheap to construct (one reference, no I/O)

## Final Review

- **Score**: 7/10
- **Feedback**: Architecture is solid. The refactor correctly follows hexagonal principles. Three actionable issues: (1) AlreadyInitializedError lost context-specific messages, (2) InputRequiredError is used as a catch-all for non-input errors, (3) ErrorHandler instanceof chain is dead code.
- **Follow-up Actions**:
  1. Fix `AlreadyInitializedError` to accept optional message, or split into two calls with different messages for init vs adopt
  2. Reclassify `doctor-use-case.ts:81` as `ManifestValidationError` and `adopt-use-case.ts:126` as `FrameworkResolutionError`
  3. Decide: keep ErrorHandler instanceof chain (document extensibility intent) or simplify to just `error instanceof Error ? error.message : String(error)`
  4. Fix `prompter-adapter.ts` to use `InputRequiredError` instead of `ToolValidationError`
