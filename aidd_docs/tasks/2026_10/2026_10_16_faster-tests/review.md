# Review: Faster mutation and test runs, guards unchanged

- Rounds: 1
- Started: 2026-10-16

## Round 1 · r-5e9a

- Date: 2026-10-16
- By: Baptiste LAFOURCADE
- Diff: `origin/next...84652353`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 4/7 met, 2 unmet, 1 unverified at runtime, 0 out of the diff

### Criteria

- [x] The mutation order is unit first, then smallest file; the normal order is unchanged — `cli/tests/helpers/mutation-sequencer.ts:27-37`, `cli/vitest.mutation.config.ts:35`; reran `tests/helpers/mutation-sequencer.unit.test.ts`: 3 passed; reversed size compare (1 red), dropped path tiebreak (1 red), reversed project rank (2 red), unknown project first (1 red), each reverted, `cmp` clean; sandboxed `vitest run -c vitest.mutation.config.ts --maxWorkers=1 tests/contexts/telemetry/application/report` ran `report-envelope.unit`, `report-usage-use-case.unit`, `report-filters.property.integration`, `report-window.property.integration` in that order; `cli/vitest.config.ts` has no sequencer
- [x] The fixable static mutants are no longer static — static count recounted from the reports: fresh baseline 330, final 158; the 6 edited test files only wrap a collection-time value in a thunk called inside each test, every assertion and `it.each` title unchanged
- [ ] No baseline kill survives; telemetry score at or above 96.5 — first half holds (independent per-mutant diff of `ft/baseline-mutation.json` against `ft/report-final/mutation.json`: Timeout→Killed 165, Timeout→Survived 7, Killed→Timeout 2, no Killed→Survived; the two Killed→Timeout at `ledger-lock.ts:107` (`now() < deadline`: never throws once past it) and `:135` (`holder()` always `null`: `continue` forever) loop without bound, real hangs); second half fails: final 96.35 < 96.5, and the contract was set `done` without amending rule 3 or this row
- [ ] Telemetry mutation wall time and `pnpm test` wall time are lower — mutation 45.5 → 6.7 min recorded; `pnpm test` gain is "within the noise of this machine" (`evidence.md:69`), so the `pnpm test` half is not shown
- Unverified at runtime: Shards stay balanced — modelled and measured on `fc143682`, before `timeoutFactor` 3 and the merge with `origin/next`; a sharded run on the head would show it
- [x] Canary scope passes, exact selection held — `evidence.md:82` on `639cee19`; `git diff --stat 639cee19 84652353` touches only `contract.md`, `evidence.md`, `plan.md`
- [x] `pnpm test`, lefthook pre-commit and pre-push, `pnpm smoke` pass — reran sandboxed on `84652353`: `pnpm test` 510 files / 6640 passed, 1 skipped; `tsc --noEmit` exit 0; biome 1 warning, in `uninstall-use-case.ts:33`, outside the diff; lefthook and smoke from `evidence.md:77-80` on `639cee19`, code-identical to the head (same `git diff --stat`)

### Findings

- `aidd_docs/tasks/2026_10/2026_10_16_faster-tests/contract.md:30` : rule 3 and acceptance row 3 (`:48`) demand 96.5, the run gives 96.35, and the contract is marked `done` with the deviation recorded only in `evidence.md`. The deviation is sound: on the 4169 shared mutants, counting every mutant seen Survived in any of the given, fresh and final runs as Survived on both sides scores the given baseline and the final run equal, 96.33 each: the gap is load-hidden survivors the baseline scored as timeouts plus one flaky kill (`git-repository-locator-adapter.ts:78`), not lost kills → amend rule 3 and row 3 to "no baseline kill survives; score at or above the baseline once its load-hidden survivors are counted" and get the user's acknowledgement — 🟡 major, fit
- `aidd_docs/tasks/2026_10/2026_10_16_faster-tests/contract.md:49` : row 4 promises a lower `pnpm test` wall time that `evidence.md:69` says was not measured above noise; the e2e split and the golden change are kept on an unmet promise → amend row 4 to what was shown (e2e subset 17.1 → 12.1 s, one golden capture fewer, CPU 270/261 → 256/258 s) or drop the two commits — 🟡 major, fit
- `aidd_docs/tasks/2026_10/2026_10_16_faster-tests/evidence.md:37` : the seven Timeout→Survived mutants list six plus `git-repository-locator-adapter.ts:78` MethodExpression, which is Killed in the final report; the seventh is `task-declaration.ts:103` MethodExpression (given Timeout, fresh Survived, final Survived) → replace it, keep the flaky locator mutant as a separate note — 🟢 minor, standards
- `cli/tests/helpers/mutation-sequencer.ts:40` : replacing `return mutationOrder(files)` with `return files` leaves all 3 sequencer tests green, and the default `statSync` size is never exercised, so the class Vitest actually loads has no guard (`coding-assertions.md`, "a guard ships with the mutation that proves it") → add a test calling `new CheapestKillerFirst(ctx).sort(specs)` on two temp files of known sizes, with a minimal fake `ctx` — 🟢 minor, conform
- `cli/stryker.conf.json:9` : `timeoutFactor` 3 is shared by every scope; each holds its floor on one local run, but `framework` lands exactly on its floor (93.0, `evidence.md:100`) with no before figure, and a larger budget can only turn timeouts into survivors → record `framework`'s score on `origin/next` from the last CI run, so a CI failure on that scope is not read as caused by this change, or not — 🟢 minor, fit
- `cli/tests/golden/framework-build-golden.e2e.test.ts:110-131` : the guard holds (capture 2 is compared to capture 1 and capture 1 to the stored snapshot, so the third capture checked nothing more; the second still starts after the first; the update path still writes the first; every assertion kept), but the `Sandbox`/`sandboxes`/`first`/`second`/`captureIn`/`firstCapture`/`secondCapture` block and its doc comment are copied almost verbatim in `cli/tests/golden/golden-baseline.e2e.test.ts:373-393` → one helper beside them taking the capture function and returning the two memoised captures plus the cleanup — 🟢 minor, rot

- Fixed: all six findings of round 1 (r-5e9a), last fix at 6c8c8b70: contract rows 3 and 4 and rule 3 amended (6c8c8b70), seventh load-hidden survivor named and flaky locator mutant noted (6c8c8b70), `CheapestKillerFirst.sort` guarded on files read from disk (eac5877b), framework CI score before recorded (6c8c8b70), golden capture sharing in one helper (9cf919bc).
