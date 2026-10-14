# Review: Render setup validation errors
- **Verdict**: approve
- **Diff**: `156f5432...65d1917a`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_10_06
- **Findings**: 0 critical, 0 warning, 0 minor
- **Score**: 100% of acceptance criteria and baseline checklist fulfilled; no severity adjustment.

## Phases
### Phase 1 — Guard setup construction and explain user scope
- [x] Unsupported plugin modes retain the cause and remedies, exit 1, and emit no exception name, stack frame, or bundle dump; the setup action creates no dependencies. Other constructor validation uses the same boundary. — `cli/src/presentation/commands/setup.ts:156`, `cli/src/presentation/commands/setup.ts:194`, `cli/tests/presentation/commands/setup-wiring.integration.test.ts:261`, `cli/tests/e2e/setup-scope-user.e2e.test.ts:28`.
- [x] Help and README describe shipped user-scope setup and plugin installation limits from current profiles; no installation capability is added. — `cli/src/presentation/commands/setup.ts:122`, `cli/README.md:71`, `cli/src/contexts/tools/domain/registry.ts:172`, `cli/src/contexts/tools/domain/profiles/cursor/profile.ts:120`, `cli/src/contexts/tools/domain/profiles/claude/profile.ts:125`, `cli/src/contexts/tools/domain/profiles/codex/profile.ts:194`, `cli/src/contexts/tools/domain/profiles/copilot/profile.ts:302`; golden diff changes only setup help.
- [x] Relevant tests, typecheck, architecture checks and lint pass; built-binary reproduction isolates user directories and host binaries. — checker rerun: 62 passed across domain, command and user-scope e2e; `cli/tests/e2e/helpers.ts:66`, `cli/tests/e2e/helpers.ts:161`, `cli/tests/e2e/helpers.ts:196`, `cli/tests/e2e/global-setup.ts:30`; `/tmp/aidd-891-commit.log:55`, `/tmp/aidd-891-commit.log:727`, `/tmp/aidd-891-push.log:828`.

## Findings
| Sev | Kind | Phase | Location | Issue | Fix |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | None. | - |

## Verification
| Metric | Value |
| --- | --- |
| Verified | 100% (3/3 acceptance criteria) |
| Files checked | All eight changed files: `plan.md`, `phase-1.md`, `backlog-link.json`, `cli/README.md`, `cli/src/presentation/commands/setup.ts`, `cli/tests/e2e/setup-scope-user.e2e.test.ts`, `cli/tests/golden/snapshots/help/surface.json`, `cli/tests/presentation/commands/setup-wiring.integration.test.ts`; canonical domain flow, error handler, registry, profiles, machine-scope use case, activation flow, binary helpers, CLI startup and project rules also inspected. |
| Unchecked | none |
| Unplanned | none; task metadata links the issue and records the agreed plan. |
| No information duplication | Fulfilled: constructor policy remains solely in `SetupFlow`; error rendering reuses `ErrorHandler`; help derives supported tools from the same registry predicate; README is the single detailed support matrix. Exact error assertions and the required golden snapshot verify their respective public contracts. |
| No incoherence or contradiction | Fulfilled: source profiles support the documented matrix, missing-host warning, native scopes and Cursor project-hook caveat. `setup --help` golden change is isolated to setup. |
| No over-engineering | Fulfilled: one existing error boundary extended to cover construction, no new abstraction, installer, dependency or configuration writer. |
| No dead code or debug leftovers | Fulfilled: every added import is used; changed lines contain no debug logs, commented blocks or silent TODOs; knip green at `/tmp/aidd-891-push.log:836`. |
| Architecture and declared rules | Fulfilled: command layer catches and exits; domain invariant remains in its constructor; presentation reads public registry capability declarations; dependencies remain in runtime wiring. `cli/.claude/rules/00-architecture/0-error-handling.md:8`, `0-hexagonal.md:11`, `0-contexts.md:13`; 140 architecture assertions, lint, typecheck and type honesty green in commit log. |
| Independent focused command | `PATH=/opt/homebrew/Cellar/node/26.8.2/bin:$PATH pnpm --dir cli exec vitest run --project=unit --project=integration --project=e2e tests/presentation/commands/setup-wiring.integration.test.ts tests/contexts/framework/domain/setup-flow.unit.test.ts tests/e2e/setup-scope-user.e2e.test.ts` => 3 files passed, 62 tests passed (23 domain, 32 command, 7 e2e), exit 0. |
| Full-suite and repository evidence | Inspected `/tmp/aidd-891-full-test.log:853`: 529 files passed, 6805 tests passed, one opt-in Kilo test skipped; repeated full-suite result and knip green in push log. Commit log proves 549 repository tests passed, zero failed, plus documentation checks and CLI gates. Full suite not repeated without a new concern. |
| Diff hygiene | `git diff --check 156f5432..65d1917a` => exit 0, no output. HEAD independently verified as `65d1917a4b7f668ca5bd804fe05fc142a179099d`. |
| Acceptance wording ambiguity | The original phrase “dependencies are not created” is broader than its command-local evidence. Caller explicitly confirmed it means the setup action's `createDeps` call (`setup.ts:172`). Existing `cli.ts:55-61` preAction can initialize dependencies for update checking first; hermetic tests disable it with `AIDD_SKIP_UPDATE_CHECK=1`. This startup behavior is unchanged and outside issue #891; caller owns clarification of the plan wording. |
| Actual end-to-end need | Fulfilled: real binary refuses all, recommended and named plugin selections with exact one-line stderr and exit 1; supported user setup remains green and leaves the project untouched. Current constructor failures are rendered before the welcome banner and command dependency graph. No contract gap found. |
