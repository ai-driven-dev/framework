# Review: Status after `off` says measurement was turned off

- Rounds: 1
- Started: 2026-10-16

## Round 1 · r-3f9a

- Date: 2026-10-16
- By: Baptiste LAFOURCADE
- Diff: `origin/next...24e74efc`
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 8/8 met, 0 unmet, 0 unverified at runtime, 0 out of the diff

### Criteria

- [x] Each Surface row and Rules 1 to 3 have a test, written first and seen failing. Evidence: the red runs in `evidence.md` (15 unit failures, then 1 e2e failure). Tests and fix land in one commit (`519ec045`), so the red run rests on `evidence.md` alone.
  - Surface: `cli/tests/e2e/telemetry-lifecycle.e2e.test.ts:154-171`.
  - Rule 1: `cli/tests/contexts/telemetry/domain/telemetry-consent.unit.test.ts:46-61` and `cli/tests/contexts/telemetry/application/declare-task-use-case.unit.test.ts:224`.
  - Rule 2: `telemetry-status-use-case.unit.test.ts:184-193`.
  - Rule 3: `telemetry-status-use-case.unit.test.ts:171-182`.
  - Rerun on `24e74efc`: `tests/contexts/telemetry` and `tests/presentation` passed 111 files / 1828 tests, and `telemetry-lifecycle.e2e.test.ts` passed 12 tests.
- [x] A never-on clone keeps today's status and task text, byte for byte.
  - The existing `no-consent` words are unchanged in `cli/src/presentation/display/telemetry-display.ts:70,82` and are now pinned by an exact `toBe` at `telemetry-display.unit.test.ts:217`.
  - In a sandboxed run of the binary, the never-on status and task output is identical before and after the change.
- [x] Each guard is proven by a mutation that turns it red. `evidence.md` M1 to M7, plus three mutations of my own, each reverted with `cp` (the worktree `src` is clean afterwards):
  - A: `turnedOff` matching trimmed and lowercased text. 4 red, among them `is not one whose key is "OFF"` and `never says a clone with no key, or a key that grants nothing, was turned off`.
  - B: `consented-repositories.ts:46` always giving `no-consent`. 2 red, `says a clone turned off was turned off, even with a log that cannot be read` and `refuses a clone turned off as turned off, and writes nothing`.
  - C: the `NOT_MEASURED["turned-off"]` text replaced with the old words. 1 red, `explains a refusal`.
- [x] `cd cli && pnpm test` and lefthook pre-commit and pre-push are green.
  - `evidence.md` records 6636 passed and every hook green.
  - I reran `pnpm typecheck` (exit 0) and `node --test scripts/__tests__/*.test.js` (452 pass, 0 fail). That includes the shared hooks fixture `"off": "absent"`, which `consentOf` still satisfies.
- [x] `pnpm smoke` passes and the bundle stays within 695 KB.
  - I rebuilt the bundle on `24e74efc`: `Bundle size: 693.1 KB / budget: 695 KB`.
  - Smoke is from `evidence.md` (`PASS: 132 FAIL: 0`). The diff touches no path that smoke asserts beyond two new strings.
- [x] `scripts/check-claude-tokens-end-to-end.cjs` passes, plain and `--attended`.
  - I reran the plain mode sandboxed: `2 calls, 393 tokens, all on task demo, ticket T-1, and on task demo in this repository`, exit 0.
  - The `--attended` result is from `evidence.md`.
- [x] Telemetry mutation is at 96 or above, and every mutant on a changed line is killed or explained.
  - `cli/reports/mutation/telemetry/mutation.json` (10:51) is newer than `519ec045` (09:19).
  - Every mutant on `consented-repositories.ts:44-51` is killed.
  - `telemetry-consent.ts:50` has one survivor, the `ConditionalExpression` on `reading.kind === "value"`. It is equivalent, because an unreadable reading has no `value`.
  - Not rerun.
- [x] Sandboxed repro: after `off`, status is wrong before the change and right after it, and a never-on clone and an on clone are unchanged.
  - Setup: two builds, one from the `origin/next` sources of the 3 changed files and one from HEAD. Each ran with HOME, XDG_CONFIG_HOME, AIDD_USER_CONFIG_DIR, AIDD_TELEMETRY_DIR and CLAUDE_CONFIG_DIR inside a fresh `mktemp -d`, and with `GIT_CONFIG_NOSYSTEM=1`.
  - On the before build, the off clone prints `Not measured: this clone has not run \`aidd telemetry on\`.`
  - On the after build, it prints `Not measured: measurement was turned off in this clone. Run \`aidd telemetry on\` to measure it again.`, and `task` exits 1 with the new words.
  - Unchanged on both builds: the never-on clone, the on clone, `AIDD_TELEMETRY=0` (`Not measured: AIDD_TELEMETRY=0.`), a key `true` set by hand (`no-consent`), `on` after `off` (`measured since`), and `on`, then `off`, then `forget --yes` (the key is unset, so `no-consent`).
  - A key `off` set by hand reads `turned-off`, as Rule 1 says.

### Findings

- `cli/src/contexts/telemetry/application/consented-repositories.ts:45-46`: a key `off` with a damaged consent log gets status `Run \`aidd telemetry on\` to measure it again`. In the sandboxed run, that `on` then exits 1 with `ledger/consents.jsonl holds a line that is not a consent event`. So the advice fails, although the next command does name the remedy (`forget --yes`).
  - Contract Rule 3 chose this on purpose, for parity with an absent key reading `no-consent` today.
  - Fix: keep it, or decide `turned-off` only once `ConsentLog.load(this.history)` is not damaged and fall through to `unreadable-consent` otherwise. That needs Rule 3 and the test at `telemetry-status-use-case.unit.test.ts:171` to be amended.
  - 🟢 minor, fit.
- `cli/tests/contexts/telemetry/application/telemetry-status-use-case.unit.test.ts:188`: contract Rule 2 lists `{}` among the keys that stay `no-consent` (`contract.md:34`), and plan step 1 names it too, but this loop covers only `"2", "true", "OFF"`. The domain test covers `{}`, the application test does not. Fix: add `"{}"` to the loop. 🟢 minor, tests.
- Both findings fixed in `f0f30ac3`: a key `off` reads `turned-off` only once the log is read and the clone identified, else `unreadable-consent`; `"{}"` added to the never-opted-in loop.
