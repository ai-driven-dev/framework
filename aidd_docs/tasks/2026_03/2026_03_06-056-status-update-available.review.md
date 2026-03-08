# Code Review — Ticket 056: Add update-available check to `aidd status`

**Date:** 2026-03-06
**Reviewer:** Martin (code review agent)
**Files reviewed:**
- `src/domain/ports/framework-resolver.ts`
- `src/infrastructure/adapters/framework-resolver-adapter.ts`
- `src/application/use-cases/status-use-case.ts`
- `src/application/commands/status.ts`
- `tests/application/use-cases/status-use-case.test.ts`
- `tests/application/use-cases/resolve-framework-use-case.test.ts`
- `tests/infrastructure/adapters/framework-resolver-adapter.test.ts`

---

## Overall Assessment

**Verdict: APPROVED with 1 minor note**

The implementation is correct, minimal, and well-scoped. All acceptance criteria are met. Tests are appropriately structured. No blocking issues.

---

## Issues Found

### 1. [MINOR] `logger` field declared but unused in `StatusUseCase`

**File:** `src/application/use-cases/status-use-case.ts:53`

```ts
private readonly logger: Logger,
```

`this.logger` is never called in the use case body. The field was pre-existing and is kept here for signature compatibility with how the command instantiates the class (alongside other use cases). The silent catch in `checkForUpdates` intentionally omits a debug log. This is pre-existing dead code — not introduced by this ticket — but worth tracking.

**Recommendation:** Not blocking. Could log a debug message in the silent catch when verbose mode is available: `this.logger.debug("fetchLatestVersion failed silently: " + error)`. Defer to a separate ticket.

---

### 2. [MINOR] In-place mutation of `ToolStatus` objects in `checkForUpdates`

**File:** `src/application/use-cases/status-use-case.ts:111-126`

```ts
tool.updateAvailable = { current, latest };
```

`checkForUpdates` mutates the tool objects built in `execute()` rather than returning new values. The pattern is internally consistent (private method, same class, immediate return), but it violates the principle of minimizing side effects. Alternative: return a `Map<ToolId, UpdateInfo>` and merge in `execute()`.

**Recommendation:** Not blocking. The current scope and mutation are contained — acceptable for this ticket.

---

### 3. [OBSERVATION] Mock boilerplate in `resolve-framework-use-case.test.ts`

**File:** `tests/application/use-cases/resolve-framework-use-case.test.ts`

Adding `fetchLatestVersion: async () => "v0.0.0"` to 6 inline resolver mocks adds repetition. These tests do not exercise version checking — the stub is purely for type compliance.

**Recommendation:** Not blocking. The `makeResolver()` helper was already updated to include it. The 3 remaining inline mocks could be replaced with `makeResolver(...)` calls to remove the duplication.

---

## What Is Correct

- Port interface correctly extends with `fetchLatestVersion(): Promise<string>` — adapter propagates errors, use case catches silently.
- `compareSemver()` is correct: 3-part integer comparison, handles `v` prefix, returns `-1|0|1`.
- Non-semver versions (`"test"`, `"local"`, `"unknown"`) are correctly excluded from comparison via the `/^\d+\.\d+\.\d+$/` guard.
- `--tool` filter correctly constrains the update check to the filtered tool set.
- Display logic is correct: update lines appear after drift blocks, before the legend; legend only appears when there is drift.
- When in sync + no updates: early return with "All files are in sync" — no regression.
- Network failure is silently swallowed — drift report always renders.
- `getLatestVersion()` (null-returning, not on port) cleanly replaced by `fetchLatestVersion()` (throws, on port) — semantics are clearer.
- `repo` and `token` are correctly forwarded to `createDeps()` in the status command so the resolver uses the same resolution chain as install.
- Tests cover: update available, up-to-date (no output), network failure (silent), `--tool` filter, `compareSemver` edge cases, `fetchLatestVersion` propagation.

---

## Conclusion

Implementation is clean, minimal, and spec-compliant. The two minor points (unused logger, mutation pattern) are not regressions from this ticket. The review confirms the code is production-ready.
