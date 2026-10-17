---
status: changes-requested
---

# Review: One call, one key; one repository, one id

Head `57169330`, base `origin/next`. Independent check, read-only on the code.

**Verdict: changes requested. Score 62/100.**

## Deal breakers

### D1. The new requestless key breaks the #1032 window property, under a bound nobody measured (High)

- **Where:** `domain/formats/claude-transcript-usage.ts:99` (the key), `domain/report/period.ts:34-39` (`windowOf`), `domain/stored-usage.ts` `daysAround`.
- **Why the bound does not cover it:** `windowOf` and `daysAround` read one day on each side. `period.ts` justifies that with "of 262,631 real keys, the widest spread is 0.3 h". That data could never contain a requestless call's copies: the earlier key ended in the timestamp, so each copy had its own key, with a spread of 0. M10 now folds copies whose spread nobody has measured. The contract says those copies "carry different timestamps", which is why they need folding at all.
- **Failure, reproduced:** one requestless call, `msg_1` in session `s`, copies at `2026-10-01T10:00Z` and `2026-10-04T10:00Z`.
  - Each `storeCalls` reads only the days around its own copy, so both copies are stored, in two days.
  - `settleLedger(windowOf({from: 2026-10-04, to: 2026-10-04}))`, filtered to the period, holds 1 record. The unbounded settle, filtered the same way, holds 0.
  - Probe output: `PROBE window bounded= 1 full= 0`.
  - Effect: the reports for 10-01 and for 10-04 sum to 2 calls. The full report says 1. The period axis is not deterministic.
- **Why the tests miss it:**
  - `report-window.property` keys every call `k${index}` and keeps its copies within `HALF_DAY`.
  - The migration property's `TIMES` keep copies seconds apart.
- **Fix:**
  - Measure the spread of `message.id:sessionId` among requestless lines in real transcripts. Then either cite the measurement in `period.ts` and in the contract's Limits, or widen the window to match it.
  - Add requestless copies more than a day apart to the window property's generator, and to the migration property's `TIMES`.

## Major

### M1. A root unreadable at the first run is never mapped, so the PR creates the split it set out to remove

- **Where:** `application/legacy/stored-usage-migration.ts:39-47`. `table()` skips any root whose status is not `repository`, and `execute` marks the table `complete` regardless.
- **Failure, reproduced:**
  - Setup: root `/w/a` has origin `git@github.com:Acme/Tool.git`, where the legacy id differs from the new one. It reads `unreadable` on the first run and `repository` on the second.
  - Probe output after both runs: `{"complete":true,"size":0}`.
  - The resolver then names that clone's new calls by the new id (`directory-resolver.ts:183`), while its stored calls keep the legacy id. Before this PR the repository had one id; after it, two.
  - The first run after an upgrade is likely to be the async `catch-up.cjs` hook, with a 110 s timeout and the hook's environment. That makes a transient `unreadable` or `gone` (an unmounted volume) plausible.
- **Contradiction:** `DirectoryResolver` treats `unreadable` as something that may become readable later (`mayConsent`). The migration treats it as final.
- **Fix:** do not mark the table `complete` while any root is `unreadable`, or keep a list of pending roots and re-locate them on later runs. Adding an alias later is safe: every reader applies the table at read time, and aliases cannot chain (see Verified).
- **Docs:** the `repository-ids.json` row in `usage-contract.md` says such a repository "keeps its earlier id". It does not say that its new calls get the new id. State the split.

## Minor

| # | Where | Finding | Fix |
| --- | --- | --- | --- |
| m1 | `domain/legacy/legacy-usage-key.ts:10-17` | Re-keying ignores `tool`. No released writer stores `codex` records: `cli-v5.5.0` and HEAD have only the Claude format, so nothing is affected today. A future codex key ending in `:session:at` would be collapsed silently. | Re-key only `claude-code` records. |
| m2 | `infrastructure/binding-snapshot-store-adapter.ts` `read()` | `branches.jsonl` is never rewritten, so it depends on `repository-ids.json` for good. If the table is damaged, `parseRepositoryAliases` returns `null` and the table is rebuilt from the clones that still exist. Snapshots of a repository whose clones are gone by then lose their alias for good, and so does their task attribution. | Document it, or rewrite `branches.jsonl` once under the bindings lock. |
| m3 | `stored-usage-migration.ts:37-48` | First-run cost is not measured. `locate` costs about four git spawns per root, including `rev-list --max-parents=0 HEAD`, which walks the whole history, though only `origin` is needed when it exists. The table is saved only after every root is located. If the `catch-up` hook's 110 s timeout is exceeded, the work is lost and redone at every SessionStart, and the hook's ingest never runs. | Measure on a large `roots.json`, or locate the remote only. |
| m4 | `usage-ledger-adapter.ts:64`, `resolution-store-adapter.ts:23`, `binding-snapshot-store-adapter.ts:17`, `ingest-usage-use-case.ts:74` | The alias store is wired three ways: built inside two adapters, and an optional parameter in the third. The `migration?` collaborator is also optional. A wiring that omits either one silently skips re-iding or migrating. | Inject both and make them required. |
| m5 | `domain/legacy/legacy-repository-identity.ts:5` | Cites `RepositoryIdMigration`, which does not exist. The class is `StoredUsageMigration`. | Rename the reference. |
| m6 | `domain/report/period.ts:34-38` | The doc's empirical bound no longer covers every key (see D1). | Update it together with D1. |
| m7 | evidence.md | Tests are committed with their code. The red runs are recorded only as text. The legacy tests went red because their modules were missing, not on behaviour. The stop property passed against the skeleton and is proven only by mutation G-h. evidence.md admits all of this, and the hand mutations compensate. | None required. |

## Verified, holds

- **Identity: no two repositories get one id.**
  - Host folding follows RFC 3986.
  - Path folding applies to `github.com` only, which GitHub documents as case-insensitive.
  - `ssh.github.com` maps to `github.com`.
  - A root-commit fallback is 40 hex characters; an address hash is 64. They cannot collide.
- **Aliases cannot chain.** A legacy id differs from its new id only when the address held an upper-case host, an upper-case path on `github.com`, or `ssh.github.com`. No new address holds any of these, so no alias target is itself aliased. Idempotence holds.
- **Legacy rule is faithful.** `legacyRepositoryIdOf` reproduces `cli-v5.5.0` exactly: it uses URL `hostname`, folds the host for scp-like addresses only, and applies the same `ownerAndRepo`.
- **Key: no merge across forms, no double count.**
  - `currentKeyOf` strips only the record's own `:session_id:at`.
  - A stored `at` is the raw `timestamp` text that the earlier key embedded, so the two always agree.
  - Keys with a `requestId` are untouched, and advisor suffixes are kept.
  - Covered: an old CLI writing after the migration, and a half-migrated store. Every reader re-keys and re-ids at read time, whether or not the table is `complete`.
- **Crash order and lock.**
  - Order: table (incomplete), then `roots.json`, then every partition, then `complete`. `save` writes before it removes, by write-then-rename.
  - The migration runs inside `ledger.exclusively`.
  - `task` takes only the bindings lock, so `prompt-gate` is not blocked.
- **git missing:** `runGit` throws inside `table()` before any write. The ingest fails, nothing persists, and the next run retries. Ingest already needs git.
- **Plugin hooks** compute no id and no key. Grep of `hooks/` for `repository_id|branches.jsonl|roots.json`: no hit.
- **Equivalent mutants confirmed.**
  - `legacy-repository-identity.ts:9`: `path` is `null` whenever `address` is.
  - `binding-snapshot-store-adapter.ts:45`: `parseBranchSnapshot` returns `null` on non-JSON and does not throw.
  - Other survivors are on untouched lines. `git diff -U0` hunks: ingest 73-74 and 96-97; ledger 5, 23, 56, 64, 78-80, 87-88, 93-94; transcript 99.
- **Docs:** `usage-contract.md` and `telemetry.md` are consistent with the code and with envelope v2. The 01-usage skill states no key or id rule, so it needs no change.
- **Bundle:** `node scripts/check-bundle-size.mjs` prints `Bundle size: 699.8 KB / budget: 709 KB`, `OK: within budget`. There is no raise, so the policy's ~2 % headroom rule does not apply. Headroom is now 1.3 %.

## Commands

| Command | Decisive output |
| --- | --- |
| `vitest run` on the identity, legacy, format and `stored-ids-and-keys` tests | `Test Files 9 passed`, `Tests 140 passed` |
| `vitest run` on `stored-usage-migration.property` and `report-window.property` | `Tests 5 passed` |
| `vitest run` on `telemetry-ingest.e2e` and `ledger-upkeep` | `Tests 27 passed` |
| scratch probe (outside the repo): requestless copies 3 days apart | `PROBE window bounded= 1 full= 0` |
| scratch probe: root `unreadable`, then readable | `{"complete":true,"size":0}` |
| `git grep "key =" cli-v5.5.0 -- formats/` | Claude format only, no codex writer |
| `node scripts/check-bundle-size.mjs` | `699.8 KB / budget: 709 KB` |

Not run: the full suite and Stryker, per the constraints. The mutation claims were verified by reading the code and the diff hunks.
