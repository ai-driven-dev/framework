---
status: changes-requested
---

# Review: One call, one key; one repository, one id (round 2)

Head `a06f9857`, base `origin/next`. Independent check, read-only on the code. Round 1 (62/100, head `57169330`) is superseded by this report.

**Verdict: changes requested, minors only. Score 86/100.**

No deal breaker. D1 and M1 hold under every interleaving the new code owns. One interleaving it does not own, lines an older CLI writes after the migration, still breaks the window property, and the contract says it does not. The project's rule forbids that ("Never state ... anything not just observed"). Every other finding is cheap.

## Deal breakers

None.

## Round 1 findings, re-checked

| # | Claim | Status | Evidence |
| --- | --- | --- | --- |
| D1 | a requestless store reads the whole ledger | fulfilled for the new CLI | `ledger-upkeep.ts:22-23`. Probe of 300 random runs (requestless copies up to ±5 days apart, requestful ±12 h, 4 ingests, then a full settle, compared with one ingest of all copies): `PROBE byte-identity mismatches 0 of 300`. The round 1 repro is now a test (`ledger-upkeep.integration.test.ts:220`) |
| D1 | settle path | holds | `settleLedger` reads the window and folds. A call the new `storeCalls` stores is on disk once, so no window can miss a copy |
| D1 | legacy monthly file | moot | `cli-v5.5.0` writes daily files only (`git show cli-v5.5.0:…/usage-ledger-adapter.ts`: monthly is "as an earlier version wrote it"). The migration's unpartitioned `save()` splits and removes any monthly file. A requestless store's full read marks every monthly file `unsettled`, and that store splits it |
| D1 | deadlock, hook cost | holds | `ledger.load` takes no lock: nothing nests under `exclusively`. Measured on 250,000 records: `PROBE cost ms withRequest= 13 requestless= 1672 heapMB= 307`. The hook allows 110 s and the lock goes stale after 10 min |
| M1 | a pending root is retried | fulfilled | `stored-usage-migration.ts:26-50`. Probe: retry twice is idempotent. A failure at each of writes 1 to 6, then a rerun, ends byte-identical to a clean retry: `crash mismatches= 0 of 6` |
| M1 | a clone replaced at the same path | no misattribution | the alias is keyed by the origin's legacy id, never by the root. Probe: the table holds only `legacyRepositoryIdOf(B) → repositoryIdOf(B)` (`09ae01a7… → aecf4b10…`, confirmed). `OLD_A` stays unmapped and its calls keep `OLD_A`. That is the documented split, not a wrong id |
| M1 | a root pending for good | cheap | `gone` costs one `realpath`, with no git spawn (`git-repository-locator-adapter.ts:33`). `unreadable` costs the git spawns per ingest. Nothing is written while the list is unchanged |
| m1 | re-keying limited to `claude-code` | fulfilled | `legacy-usage-key.ts:14`; mutant killed |
| m2 | damaged-table cost documented | fulfilled | `usage-contract.md` `repository-ids.json` row |
| m3 | first-run cost measured | fulfilled | evidence.md: 4.5 s and 20.8 s |
| m4 | wiring required | partial | see n5 |
| m5 | stale reference | fulfilled | `legacy-repository-identity.ts:5` |
| m6 | `period.ts` states both bounds | fulfilled | `period.ts:35-42` |

Round 1 "Verified" properties re-checked, no regression: no two repositories share an id; no alias chains (a pending root adds only a legacy-to-new pair, and new ids carry no upper case and no `ssh.github.com`); no merge across key forms; write-then-rename crash order; the migration runs inside `ledger.exclusively`; hooks compute no id and no key.

## Minor

### n1. An older CLI's requestless lines, written after the migration, still break the window property (Medium)

- **Where:**
  - the claims: `contract.md:74` (Read-time row), `contract.md:77`, `usage-contract.md:59` (Key row: "the ledger holds it once");
  - the cause: `ledger-upkeep.ts:22`, which takes the full read only when an incoming record is requestless.
- **Failure, reproduced:**
  - Setup: the table is complete. cli-v5.5.0 then stores `msg_1:s-1:<at>` on 10-01 (output 9) and on 10-04 (output 1).
  - A report bounded to 10-04 re-keys and counts the 10-04 copy. The full read folds both copies to the 10-01 one.
  - Probe: `PROBE old-cli bounded= 1 full= 0`.
  - Only a report with no period heals it, or a later requestless ingest by the new CLI.
- **Likelihood:** low. 0 requestless lines were measured, and it needs a downgrade or a pinned older binary.
- **Fix:** add a Limits row ("requestless lines an older CLI writes after the migration: a bounded report may count a copy until a report with no period settles the ledger"), and qualify `contract.md:74` and `usage-contract.md:59` to match.

### n2. Stale docs: the window and the cost claims no longer hold for every ingest

| Where | Says | Now |
| --- | --- | --- |
| `usage-contract.md:164` | "Ingest reads its calls' days and the day on each side" | a requestless store reads every day and splits every monthly file. This contradicts the Key row at `:59` |
| `usage-contract.md:127` | "The copies of one call have been observed less than a day apart" | true only of calls with a request id. Qualify it as `period.ts` does |
| `usage-ledger-adapter.ts:41-42` | "An ingest reads the days around its calls … so its cost does not grow with the ledger" | false for a requestless store |
| `cli/aidd_docs/memory/telemetry.md:55` | "rewritten once by the first ingest" | rewritten again when a pending root adds an id |
| `contract.md:59` (flowchart) | `complete? yes → ingest as usual` | complete with roots pending → locate the pending roots, and maybe rewrite |
| `contract.md:94` | "storing one reads the whole ledger (4.5 s at 250,000 records)" | 4.5 s is the migration's first run, git included. The requestless store measured 1,672 ms at 250,000 records. Cite the figure that was observed |

### n3. Survivors in the changed lines (Stryker, narrow scope: 97.12 %, 101 killed, 3 survived)

- **`claude-transcript-usage.ts:80`, `\d+$` mutated to `\d$`: survives.** A key ending `#advisor10` is not recognised. This is harmless in practice: the main record of the same message is in the same batch and triggers the full read. It is still a guard the tests do not pin.
  - Fix: add a two-digit case to `claude-transcript-usage.unit.test.ts:333`.
  - Better: reuse `ADVISOR` from `legacy-usage-key.ts:4`. The regex is duplicated (DRY).
- **`claude-transcript-usage.ts:80`, with the `$` anchor removed: equivalent.** `#advisor` only ever appears as the suffix the format appends (`:139`). Message and session ids carry no `#advisor<n>`.
- **`stored-usage-migration.ts:28` mutated to `if (false) return`: equivalent.** A complete table with nothing pending reaches `locate([])`. The sizes are then equal and nothing is pending, so the run returns without writing. The guard is redundant ("a guard nothing fails for is not a guard", `coding-assertions.md`).
  - Fix: delete it, or keep it and label it as a fast path.

The "12 of 12 hand mutations" claim stands. They were not exhaustive.

### n4. Generator gaps

- The migration property (`stored-usage-migration.property.integration.test.ts`) generates no `unreadable` or `gone` roots. The retry path is covered only by example tests.
- No test fails a write during a retry rewrite. My probe covered that case (above).
- The window property drives `storeCalls` directly and never emits legacy-keyed lines written after the migration. That gap is why n1 went unseen.
- Fix: add a pending root that turns readable to the migration generator, and an older CLI's timestamped requestless lines to the window generator. The second one should go red until n1 is either fixed or excluded by name.

### n5. m4 is half done; the placement is arguable

- **m4:** `UsageLedgerAdapter` (`usage-ledger-adapter.ts:58`) and `ResolutionStoreAdapter` (`resolution-store-adapter.ts:22`) still build their own `RepositoryAliasStoreAdapter`. `BindingSnapshotStoreAdapter` has its store injected. All three read the same file, so nothing is incorrect, but the wiring is inconsistent. Fix: inject the store everywhere, or say in one line why the two adapters build their own.
- **Placement:** `ledger-upkeep.ts:1` makes the tool-agnostic upkeep import a Claude-format predicate. A per-format "copies unbounded in time" predicate would keep the format knowledge in its own module. No action is needed while there is only one format.

## Tests-first

- evidence.md records red runs for D1 (the pinned case and the window property's counterexample), M1 (10 failed, 15 passed) and m1.
- Tests ship in the same commits as their code, as in round 1 (m7, accepted).
- The migration property was extended, but it passed on the unfixed code. evidence.md says so.

## Checklist

| Item | Result |
| --- | --- |
| No duplication | partial: the advisor regex is duplicated (n3) |
| No incoherence | partial: n1 and n2 |
| No over-engineering | partial: redundant guard at `stored-usage-migration.ts:28` (n3) |
| No dead code or debug leftovers | holds: `git diff 57169330..a06f9857 -- cli/src` has no logs and no TODOs |

## Bundle

`node scripts/check-bundle-size.mjs` prints `Bundle size: 700.7 KB / budget: 709 KB`, `OK: within budget`. `dist/cli.js` was built at the head commit's time. The budget is unchanged, so the headroom rule in `check-bundle-size.mjs` is not triggered. Headroom is now 1.2 %.

## Commands

| Command | Decisive output |
| --- | --- |
| `vitest run` on the 14 test files changed since `57169330` | `Test Files 14 passed`, `Tests 242 passed` |
| scratch probe: N ingests plus a full settle vs one ingest, 300 runs | `PROBE byte-identity mismatches 0 of 300` |
| scratch probe: requestless lines from an older CLI, after the migration | `PROBE old-cli bounded= 1 full= 0` |
| scratch probe: 250,000-record ledger, one store | `withRequest= 13 requestless= 1672 heapMB= 307` |
| scratch probe: M1 retry, failure at each write, replaced clone | `twice-idempotent= true crash mismatches= 0 of 6`; `OLD_A mapped? false` |
| `stryker run -m <changed line ranges of 5 files>`, under `mutation.lock` | `97.12`, 101 killed, 3 survived |
| `node scripts/check-bundle-size.mjs` | `700.7 KB / budget: 709 KB` |

Not run: the full suite (pre-push passed it at `a06f9857`: 6,808 tests).

## Score

86 = 100, minus 6 (n1: a contract claim falsified by a probe), minus 4 (n2: six stale statements), minus 2 (n3), minus 1 (n4), minus 1 (n5).
