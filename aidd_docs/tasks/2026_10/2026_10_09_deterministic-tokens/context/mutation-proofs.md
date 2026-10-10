# Mutation proofs

For each rule, the test that guards it, the one scripted change that breaks the rule, and what
turned red. Each mutation was applied by script on the file named, the named tests were run,
and the file was restored byte for byte.

## Phases 3 to 9, earlier rounds

To be filled by orchestrator.

| Phase | Status |
| --- | --- |
| 3 | to be filled by orchestrator |
| 4 | to be filled by orchestrator |
| 5 | to be filled by orchestrator |
| 6 | to be filled by orchestrator |
| 7 | to be filled by orchestrator |
| 8 | to be filled by orchestrator |
| 9 | to be filled by orchestrator |

## Fix round 1, phase 4 (store, ingest, consent)

| Rule | Test | Mutation | Result |
| --- | --- | --- | --- |
| Partitioning is linear in the records | `stored-usage.unit.test.ts` "copies each record a bounded number of times" (counts array iteration, deterministic) | `partitionByMonth` copies the month array per record again (`[...(held ?? []), record]`) | 1 red, that test (2,003,001 elements touched at n=2000 before the fix) |
| An upsert names the months it changed, the old month of a replaced record included | `stored-usage.unit.test.ts` "names the months it changed" | loop over `[record]` instead of `[record, was]` | 1 red, that test |
| Ingest tells the ledger which months to write | `ingest-usage-use-case.unit.test.ts` "rewrite only the month a new call falls in" | `save(merged.records)` without the months | 1 red, that test |
| A save told the months reads and writes only those | `usage-ledger-adapter.integration.test.ts` "rewrites only the months it is told changed" | the filter by told months removed | 1 red, that test |
| A snapshot reads and appends under the bindings lock | `snapshot-bindings-use-case.unit.test.ts`, `bindings-lock-adapter.integration.test.ts` "leaves one snapshot when ... at once", `declare-task-use-case.unit.test.ts` | `append` called without `lock.exclusively` | 3 red: the snapshot lock order, the concurrent-snapshot test (3 writers, more than 1 snapshot), the declare order |
| A declaration's session line is appended under the bindings lock | `declare-task-use-case.unit.test.ts` (event order, default-branch order) | `sessions.append` outside the lock | 2 red, those tests |
| A declaration never waits on the ledger lock | `telemetry-task.e2e.test.ts` "declares at once while an ingest holds the ledger lock" | not mutated: before the fix the test timed out at 5 s (declaration blocked, 60 s lock wait); the declare use case no longer receives the ledger | red on the pre-fix binary, green after |
| `on` lifts a remembered refusal by repository, a deleted linked worktree included | `resolution-consent.unit.test.ts`, `telemetry-switch-use-cases.unit.test.ts` "linked worktree deleted before the opt-in" | `ofRepository = false` | 2 red |
| `on` passes the repository id | same use-case test | `repositoryIdOf(located)` replaced by `null` | 1 red |
| A declaration is read at the call's time within a branch generation, the first one covering from creation | `attribution.unit.test.ts` three new "redeclaration" tests | `generationAt` returns `generation.at(-1)` (latest snapshot) | 3 red |

## Fix round 1, phase 6 (hooks)

| Rule | Test | Mutation | Result |
| --- | --- | --- | --- |
| A prompt that only starts like a declaration, or holds shell syntax, goes to the ordinary gate and spawns nothing | `aidd-telemetry-hooks.test.js` "injection" and "only starts like a declaration" | an intercepted prompt that does not parse blocks "not understood" again | 2 red |
| The `cmd.exe /s` line has an outer pair of quotes | same file, "cmd.exe /s command line" | `cmdLine` returns `"shim" args` | 1 red |
| The hook's home is the OS home, as the CLI's | same file, "the telemetry directory's home" | `home ?? set(env.HOME) ?? os.homedir()` | 1 red |
| A committed `.aidd/config.json` is not consent | same file, "a committed .aidd/config.json is not consent" | the hook also accepts a committed `telemetry.version === 2` | 1 red |
| `AIDD_TELEMETRY=0` refuses before git is asked | same file, "AIDD_TELEMETRY=0 refuses" and the session-start test | the environment check removed | 2 red |

## Fix round 1, phase 8 (consent, leftovers, forget)

| Rule | Test | Mutation | Result |
| --- | --- | --- | --- |
| Nothing in `.aidd/config.json` is consent (CLI) | `git-consent-adapter.integration.test.ts`, `telemetry-lifecycle.integration.test.ts` | the adapter falls back to a committed `telemetry.version === 2` | 2 red |
| `AIDD_TELEMETRY=0` refuses (CLI) | `declare-task-use-case.unit.test.ts`, `ingest-usage-use-case.unit.test.ts` | each refusal check removed in turn | 1 red each |
| `on` removes the previous version's block, and deletes the file only when emptied | `telemetry-switch-use-cases.unit.test.ts`, `telemetry-lifecycle.integration.test.ts` | the legacy cleaning replaced by "none" | 6 red |
| `off` writes `off` | `telemetry-switch-use-cases.unit.test.ts` | the write removed | 1 red |
| `forget` unsets the consent key | `repository-declarations-adapter.integration.test.ts` | the consent key left out of the unset loop | 1 red |
| `forget` finds a repository that only opted in | `forget-telemetry-use-case.unit.test.ts` | consented resolutions no longer added | 1 red |
| `on` ends with the next step | `telemetry-lifecycle-display.unit.test.ts` | "Next:" line reworded | 1 red (after the test was tightened: the first version of the test survived this mutation) |
| The unknown-counter message says what happens to the call | the two display tests | message back to "not recognised and not counted" | 2 red |

Not mutated: removing `outside-repo` and `root-unresolved` from the unattributed reasons (a
type-level change: the exhaustive `Record<Reason, string>` makes a reinstated reason fail the
typecheck), and the documentation corrections.
