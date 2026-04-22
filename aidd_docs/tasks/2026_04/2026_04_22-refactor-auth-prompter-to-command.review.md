---
name: code-review
description: Code review checklist and scoring template
argument-hint: N/A
---

# Code Review for Refactor Auth — Prompter to Command

Auth refactor moving `Prompter` calls out of the use-cases into the command layer. Introduces `AuthCredential` discriminated union, `AuthProvider` port, `AuthProviderAdapter`, `LoginVerifier` port, `GhTokenAdapter`, and `ExternalAuthProvider` port. All three auth use-cases become thin delegators. `AIDD_DIR` constant introduced. 16 auth-specific files changed, 338 insertions / 671 deletions.

- Status: Needs fixes
- Confidence: 9/10

---

- [Main expected Changes](#main-expected-changes)
- [Scoring](#scoring)
- [Code Quality Checklist](#code-quality-checklist)
  - [Potentially Unnecessary Elements](#potentially-unnecessary-elements)
  - [Standards Compliance](#standards-compliance)
  - [Architecture](#architecture)
  - [Code Health](#code-health)
  - [Security](#security)
  - [Error management](#error-management)
  - [Performance](#performance)
  - [Backend specific](#backend-specific)
- [Final Review](#final-review)

## Main expected Changes

- [x] `AuthCredential` discriminated union introduced (`stored | external`)
- [x] `AuthProvider` port with `login / status / logout` methods
- [x] `AuthProviderAdapter` encapsulates all auth logic
- [x] `AuthLoginUseCase` / `AuthLogoutUseCase` / `AuthStatusUseCase` reduced to thin delegators
- [x] Command resolves credential and level inline before calling use-case
- [x] `AIDD_DIR` constant introduced and propagated across files
- [x] Tests rewritten to mock `AuthProvider` port instead of internals

## Scoring

- [🔴] [**Standards Compliance**]: `tests/e2e/auth.e2e.test.ts:42,54,74` — E2E test writes JSON fixture with `method: "token"` but the new `AuthMethod` type is `"stored" | "external"`. `isAuthConfig` rejects `"token"`, so `AuthStorage.read()` returns `null` — logout finds no config and leaves the auth.json on disk. Confirmed: `pnpm test:e2e -- tests/e2e/auth.e2e.test.ts` fails right now on `expect(existsSync(join(authDir, "auth.json"))).toBe(false)`. This is a broken E2E test, not just a stale value. (Change `"token"` to `"stored"` at lines 42, 54, 74.)
- [🟡] [**Standards Compliance**]: `src/infrastructure/adapters/auth-provider-adapter.ts:2-3` — Two consecutive `import type` statements from the same module (`../../domain/models/auth.js`). Should be merged into a single import declaration per Biome formatting convention. (Merge into `import type { AuthConfig, AuthCredential, AuthLevel } from "../../domain/models/auth.js";`.)
- [🟡] [**Standards Compliance**]: `src/application/commands/auth.ts:60` — Prompt option label reads `"Project (.aidd/auth.json)"` as a hardcoded string literal. It should reference `AIDD_DIR` to stay consistent with the constant introduced in this very PR. (Replace `.aidd` with `${AIDD_DIR}` and import `AIDD_DIR`.)
- [🟡] [**Standards Compliance**]: `tests/application/use-cases/auth-login-use-case.integration.test.ts:24,34` — Two test names start with `"calls login with …"` which is banned by the naming rule ("Banned: calls execute()"). The rule forbids implementation-centric prefixes. (Rename to e.g. `"stores PAT credential at user level when login succeeds"` and `"stores external credential at project level when login succeeds"`.)
- [🟢] All `.js` ESM extensions present on all new imports
- [🟢] `import type` used consistently for type-only imports (with the duplicate noted above)
- [🟢] All new types use `PascalCase`, constants use `CONSTANT_CASE`

- [🔴] [**Architecture**]: `src/application/commands/auth.ts:74-76` — `process.exit(1)` is called inside the `try` block (line 76) when the PAT token is empty. The rule states: all guards with `process.exit(1)` must be before the `try/catch`. An empty token entered at the prompt is a user input error, not an unexpected exception — it should be treated as a guard. (Move the empty-token check before the `try` block, or throw a typed `InputRequiredError` and let `errorHandler.handle` catch it.)
- [🟡] [**Architecture**]: `src/domain/ports/external-auth-provider.ts` — `ExternalAuthProvider` extends `ExternalTokenProvider`, combining `resolve()` (sync, returns `string | null`) with `verify()` (async, returns `Promise<string>`). This couples two different responsibilities into one port. `AuthReader` only needs `ExternalTokenProvider`; `AuthProviderAdapter` needs `verify()`. The extension is convenient but violates single-responsibility on the port. (Consider keeping the two ports separate and injecting both independently, or keep the extension but document the intent clearly.)
- [🟡] [**Architecture**]: `src/domain/models/auth-config.ts` and `src/domain/models/auth-level.ts` — These files now only re-export from `auth.ts`. They exist solely as backward-compatibility shims. No code in the diff imports from them (all callers were updated to use `auth.ts` or the port). If no consumers remain, delete these shim files. If they are kept for external compatibility, add a comment explaining why.
- [🟢] `AuthProvider` port has 3 methods — within the ≤5 limit
- [🟢] `AuthProviderAdapter` implements exactly one port
- [🟢] All method sizes in `AuthProviderAdapter` are within the 20-line limit (longest is `logout` at ~14 code lines)
- [🟢] `paths.ts` has no imports from `application/` or `infrastructure/`
- [🟢] `auth.ts` domain model has no I/O and no infrastructure dependencies
- [🟢] Command calls exactly one use-case per sub-command action
- [🟢] `buildAuthProvider` is a local factory helper, not business logic

- [🟡] [**Code Health**]: `src/infrastructure/auth/auth-reader.ts:7-11` — `AuthContext` is declared in `auth-reader.ts` (infrastructure layer) but it's a pure data shape with domain-level types (`AuthLevel`, `AuthMethod`, `token: string`). It's used by other infrastructure/application code through the port. Per the rule "domain models live in `src/domain/models/`", this type belongs in `auth.ts` alongside the other auth types — or at minimum, the file it lives in should be noted as an exception. (Consider moving `AuthContext` to `src/domain/models/auth.ts`.)
- [🟡] [**Code Health**]: `tests/application/use-cases/auth-logout-use-case.integration.test.ts:26` — The test instantiates a real `AuthProviderAdapter` with a real `GhCliAdapter` and `HttpClient`. This makes the logout integration test depend on concrete infrastructure adapters. Since logout does not invoke network or `gh` CLI, the dependency is harmless in practice, but it couples the test to the full adapter graph unnecessarily. (Prefer injecting a stub `AuthProvider` port, as the login and status integration tests do.)
- [🟢] No dead code or commented-out blocks introduced
- [🟢] No magic string literals outside of the `process.exit` / prompt label issues already flagged

- [🟢] [**Security**]: Token written with `chmod 600` on POSIX; `icacls` restriction on Windows — no regression here
- [🟢] No token values appear in logs (log messages reference source, not value)
- [🟢] `provider` field stored to `AuthConfig` for external credentials — no token stored when method is `external`

- [🟡] [**Error management**]: `src/application/commands/auth.ts` — `auth status` no longer emits a dedicated "Not authenticated" message or `process.exit(1)` when not logged in. Previously the command exited 1 on unauthenticated/invalid state. Now it delegates entirely to `errorHandler.handle(error)` which will surface the `AuthenticationError`. This is architecturally correct (the adapter throws), but the user-facing message may be less readable than the old explicit `"Not authenticated. Run aidd auth login"`. Not a bug, but a UX regression worth noting.
- [🟢] `AuthProviderAdapter` translates all errors to `AuthenticationError` before crossing the port boundary
- [🟢] Use-cases do not catch internally — they throw as required

- [🟢] [**Performance**]: No performance concerns — the refactor reduces round-trips vs. the old dual-storage-read pattern in `auth-status-use-case.ts`

## Backend specific

### Logging

- [🟢] Debug logs in `AuthReader` correctly reference the source path without leaking the token value
- [🟢] Log test (`auth-reader.integration.test.ts:200-213`) verifies token is not logged — good guard

## Final Review

- **Score**: 7.5/10
- **Feedback**: The refactor is structurally sound. The three use-cases are correctly simplified to thin delegators, the `AuthCredential` discriminated union is clean, and `AIDD_DIR` propagation is complete. Three issues block a clean merge: (1) the E2E fixture uses the stale `method: "token"` value which would cause `isAuthConfig` to reject it at runtime; (2) a `process.exit(1)` is inside the `try` block against the command layer rule; (3) one test name uses the banned "calls" prefix.
- **Follow-up Actions**:
  1. [BLOCKING — TEST FAILING] Fix `tests/e2e/auth.e2e.test.ts` lines 42, 54, 74 — change `method: "token"` to `method: "stored"`. The logout E2E test currently fails: `isAuthConfig` rejects the fixture, `read()` returns `null`, logout does nothing, and the auth.json remains on disk.
  2. [BLOCKING] Move the empty-token `process.exit(1)` at `auth.ts:76` outside the `try` block, or convert to a thrown `InputRequiredError`.
  3. [MINOR] Rename test at `auth-login-use-case.integration.test.ts:24` — remove "calls" prefix.
  4. [MINOR] Merge the two consecutive `import type` from `../../domain/models/auth.js` in `auth-provider-adapter.ts`.
  5. [MINOR] Replace `.aidd` string literal in the prompt label at `auth.ts:60` with `${AIDD_DIR}`.
  6. [OPTIONAL] Move `AuthContext` from `auth-reader.ts` to `src/domain/models/auth.ts` or document why it belongs in infrastructure.
  7. [OPTIONAL] Delete `auth-config.ts` and `auth-level.ts` shim files if no consumers remain outside this PR.
- **Additional Notes**: The `ExternalAuthProvider extends ExternalTokenProvider` pattern is a minor design concern but acceptable given the `GhCliAdapter` genuinely needs both capabilities. The logout integration test using a real adapter is not a bug — it does exercise real filesystem operations — but should be tracked as tech debt if the test graph grows.
