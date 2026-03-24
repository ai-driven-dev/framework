---
name: code-review
description: Code review checklist and scoring template
---

# Code Review for feat(opencode): detect existing opencode.jsonc config file (b9fcac6)

The commit introduces dynamic resolution of the opencode config file path (`opencode.json` vs `opencode.jsonc`). All 4 planned phases are implemented. Implementation matches the plan faithfully.

- Statuts: approved with minor remarks
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

- [x] `resolveOpencodeConfigPath()` domain helper in `opencode.ts`
- [x] `InstallUseCase.writeToolFiles()` substitutes `opencode.json` → resolved path
- [x] `UpdateUseCase.executeInternal()` substitutes before `computeDiff()`
- [x] `SyncUseCase` excludes `opencode.jsonc` from `EXCLUDED_FILES`

## Scoring

- [🟡] **Architecture**: `src/domain/tools/opencode.ts:193` `resolveOpencodeConfigPath` is an async function that calls `fs.fileExists` twice — it introduces a `FileSystem` port dependency inside the domain layer. Rule `0-hexagonal.md` states "Domain never imports from application or infrastructure." Importing a port interface (not an adapter) is technically permitted, but the function performs I/O resolution that belongs in the application layer. It operates as an input-preparation helper for use cases, not as domain business logic. Placing it in `opencode.ts` conflates tool configuration (pure domain) with filesystem-dependent path resolution (application concern). Moving the function to a shared helper in `application/use-cases/` or to a dedicated `opencode-config-resolver.ts` in `application/` would restore clean separation.

- [🟡] **Code Health**: `src/application/use-cases/update-use-case.ts:208` `resolveOpencodeConfigPath` is called inside the `for (const toolId of effectiveToolIds)` loop. Since the result depends only on `projectRoot` and the filesystem state (which cannot change mid-loop), calling it N times per update run is redundant. This is a minor performance and correctness concern — if both files appear between iterations (unlikely but possible), the results would diverge. Hoist to before the loop.

- [🟡] **Code Health**: `src/application/use-cases/install-use-case.ts:183` and `update-use-case.ts:218` — the substitution logic (`f.relativePath === "opencode.json" && f.merge`) is duplicated verbatim across two use cases. A shared inline helper or a single exported function would remove the duplication.

- [🟢] No magic strings — `"opencode.json"` and `"opencode.jsonc"` are consistent across files.
- [🟢] Sync exclusion is minimal and correct — one line added to `EXCLUDED_FILES`.
- [🟢] Error message is user-facing and actionable.
- [🟢] `GeneratedFile` reconstruction preserves all fields (`content`, `hash`, `merge`, `frameworkPath`).
- [🟢] No test coverage existed before for `resolveOpencodeConfigPath` — no regression introduced, but no tests added either.

## Code Quality Checklist

### Potentially Unnecessary Elements

- [x] No dead code or unused imports introduced.

### Standards Compliance

- [x] Naming conventions followed (`resolveOpencodeConfigPath` — camelCase function, kebab-case file)
- [x] Coding rules ok — `async`, `Promise<string>` return type, named export

### Architecture

- [ ] **Design patterns respected** — `resolveOpencodeConfigPath` is async and depends on `FileSystem`, making it I/O-bound. Placing it in `domain/tools/` violates the principle that domain tools are pure configuration objects with no side effects. The port interface import is the boundary line here: importing `FileSystem` (a port) inside domain is technically allowed by the hexagonal rule, but the function's *behavior* (filesystem reads) is application-layer work.
- [x] Proper separation of concerns — `SyncUseCase` exclusion is purely additive and correctly scoped.

### Code Health

- [ ] **Functions and files sizes** — `opencode.ts` grows to 209 lines. Acceptable but trending toward needing extraction.
- [ ] **Cyclomatic complexity** — `resolveOpencodeConfigPath` is simple (two checks), no issue.
- [x] No magic numbers/strings
- [x] Error handling complete in `resolveOpencodeConfigPath`
- [x] User-friendly error message for both-files-exist case

### Security

- [x] No SQL injection, XSS, auth, or CORS concerns — filesystem path resolution only.
- [x] No environment variables or secrets involved.

### Error management

- [x] `resolveOpencodeConfigPath` throws a descriptive `Error` on ambiguous state — consistent with the use-case rule (use cases throw, commands catch).
- [x] Error propagates correctly up through `writeToolFiles()` and `executeInternal()` to the command-level `output.exit()`.

### Performance

- [ ] `resolveOpencodeConfigPath` called N times in `UpdateUseCase` loop (once per installed tool). Two `fileExists` calls per invocation = 2N filesystem hits when only 1 resolution is needed. Low impact in practice but avoidable.

### Backend specific

#### Logging

- [x] No new logging needed — error path throws, success path is silent as expected.

## Final Review

- **Score**: 7.5/10
- **Feedback**: The implementation is correct and complete per the plan. All edge cases (no file, json only, jsonc only, both) are handled. The main issue is architectural: `resolveOpencodeConfigPath` performs filesystem I/O from inside the domain layer. A secondary issue is the redundant call inside the update loop and the duplicated substitution logic across two use cases. None of these are blocking for merge — they are refactor candidates.
- **Follow-up Actions**:
  - Move `resolveOpencodeConfigPath` to `application/` (e.g. a shared helper or into a common file alongside the two use cases that call it)
  - Hoist `resolveOpencodeConfigPath` call outside the `effectiveToolIds` loop in `UpdateUseCase`
  - Extract the `GeneratedFile` substitution block into a shared helper to avoid duplication between `InstallUseCase` and `UpdateUseCase`
  - Add unit tests for `resolveOpencodeConfigPath` covering all 4 filesystem states
- **Additional Notes**: The `restore-use-case.ts` does not write opencode config files (restore only rewrites tracked non-merge files), so no gap there. The `config().outputPath()` in `opencodeToolConfig` still hardcodes `"opencode.json"` — this is consistent because it is the canonical framework-side path; the runtime substitution happens post-generation in use cases, which is the correct design.
