# Evidence

## Red runs, before any production change

### Phases 1 and 2 (identity and key rules)

`pnpm exec vitest run` on the identity, legacy and format tests: 15 failed, 92 passed. The two legacy test files failed to load (their modules did not exist yet); their behaviour went red under the hand mutations below.

```txt
× owner and repo in another case gives one spelling
  AssertionError: expected 'github.com/Acme/Widgets' to be 'github.com/acme/widgets'
× ssh:// upper-case host gives one spelling
  AssertionError: expected 'GitHub.COM/acme/widgets' to be 'github.com/acme/widgets'
× ssh over the https port gives one spelling
  AssertionError: expected 'ssh.github.com/acme/widgets' to be 'github.com/acme/widgets'
× https in another case, upper-case .GIT on github.com, ssh:// with a port, git://, git+ssh://,
  ssh over the https port in upper case, credentials and a port: one spelling each
× keeps the case of the path on a host not known to ignore it, whatever the form
× is the sha256 of the normalised remote, whatever its spelling
× keys a requestless call by message id and session id, so its copies are one key
× keys a requestless call's advisor iterations under the same key
× reads an empty request id as none
```

### Phase 3 (stored data), against skeletons that compile and migrate nothing

10 failed: every adapter and migration case, and two of the three properties.

```txt
× re-keys a requestless call's copies stored apart, re-ids them, and counts the call once
  AssertionError: expected [ Array(2) ] to deeply equal [ { tool: 'claude-code', …(15) } ]
× folds a line an earlier version writes after the migration into the call it is a copy of
× name each repository by its id of now
× join an earlier id's snapshots to the history of its id of now, the file untouched
× maps the id an earlier version gave each live root's origin to the id of now, and rewrites roots.json and the ledger
× maps nothing for an origin both rules name alike, nor for a root with no origin
× finishes an unfinished one with its own table, asking git nothing
× writes its table before anything else, and says it is complete last
× reports, and lies on disk, as one fresh ingest of the same copies under the rules of now
  Caused by: AssertionError: expected [ …(6) ] to deeply equal [ …(6) ]
× migrated twice is migrated once
```

What the properties generate: requestless and requested calls, advisor iterations, copies across midnight and a month end, earlier reads in up to four batches, the monthly layout, three spellings of one GitHub repository, another host and a repository with no origin, every clone live and recorded in `roots.json`. Not generated: undated calls, a clone gone at the migration, an origin changed since its calls were stored (all stated limits). The stop property injects a failure at every `replace`; the removals that follow the writes and a `kill -9` are reasoned, not exercised.

The third property (stop at any write, then rerun) passed against the skeleton, since a migration that does nothing also does nothing when stopped. It is proven by mutation G-h below.

## Hand mutations

Each mutation applied alone to the final code, the named tests run, the file restored: 23 of 23 went red.

| # | Guard broken | Red tests (first ones) |
| --- | --- | --- |
| M7-a | host case-folded on every form | scp-like upper-case host, ssh:// upper-case host (8 tests) |
| M7-b | `ssh.github.com` is `github.com` | ssh over the https port (2) |
| M7-c | path case-folded on `github.com` only (folded everywhere) | keeps the case of the path on a host not known to ignore it (2) |
| M7-d | path case-folded on `github.com` at all | owner and repo in another case (7) |
| M7-e | the earlier rule folds a scp-like host only | of ssh://git@GitHub.COM:22/... hashes GitHub.COM/... (2) |
| M10-a | requestless key without the timestamp | keys a requestless call by message id and session id (3) |
| K-a | an earlier key is re-keyed | drops the timestamp from a requestless key; the fresh-ingest property |
| K-b | advisor suffix kept | keeps an advisor iteration's suffix |
| K-c | only the call's own session and time dropped | drops only the call's own time, after its own session |
| L-a | the ledger read applies the rules | re-keys a requestless call's copies stored apart (6) |
| L-b | a re-keyed partition is rewritten | maps the id ... and rewrites roots.json and the ledger (3) |
| R-a | `roots.json` read re-ids | name each repository by its id of now (2) |
| S-a | snapshots read re-id | join an earlier id's snapshots; the fresh-ingest property |
| G-a | a complete table asks nothing and rewrites nothing | asks git nothing and rewrites nothing once complete (survived first: the test only checked git; strengthened to check the files) |
| G-b | an unfinished table is reused | finishes an unfinished one with its own table |
| G-c | the table is written first | writes its table before anything else (2) |
| G-d | `roots.json` rewritten | the fresh-ingest property (3) |
| G-e | the ledger rewritten | finishes an unfinished one (3) |
| G-f | the table marked complete | maps nothing ... (4) |
| G-g | only a changed id is mapped (`if (true)`) | maps nothing for an origin both rules name alike, nor for a root with no origin |
| G-i | no `roots.json` made where there was none | leaves no roots.json where there was none |
| G-h | complete only after the rewrite (marked complete at once) | stopped at any write and run again, ends as a run never stopped |
| I-a | ingest migrates first | the fresh-ingest property; migrated twice is migrated once |

## Gates

| Gate | Result |
| --- | --- |
| `cd cli && pnpm test`, first full run | 3 failed: `folder-size` (three telemetry folders past ten files), `orchestrator-deps` (ingest's sixth collaborator), `telemetry-ingest.e2e` (the new `repository-ids.json`). Fixed by `legacy/` subfolders, the count with its reason, the expected listing |
| second full run | 3 failed: `codebase-map` (the two new `legacy/` folders), and the fresh-ingest property timing out at 60 s under the full suite's load (a cascade `ENOTEMPTY` in the next test). Fixed by the map, and the 240 s timeout the other telemetry properties use |
| third full run | 518 files passed, 1 skipped; 6,779 tests passed, 1 skipped |
| final full run, after the survivor tests | 519 files passed, 1 skipped; 6,789 tests passed, 1 skipped |
| `node --test 'scripts/__tests__/**/*.test.js'` | first run: 3 failed, `check-markdown-links` (this folder's `phase-4.md` linked `evidence.md` before it existed); after: 460 of 460 passed |
| `pnpm smoke` | PASS 132, FAIL 0, SKIP 1, coverage 100% |
| `node scripts/check-claude-tokens-end-to-end.cjs cli/dist/cli.js` | `2 calls, 393 tokens, all on task demo, ticket T-1, and on task demo in this repository` |
| same, `--attended` | same, `asked, answered by the hook, kept across /clear` |

## Bundle

| Step | `dist/cli.js` |
| --- | --- |
| `origin/next` `616dbbea` | 712,722 B (696.0 KB) |
| this change | 716,597 B (699.8 KB), budget 709 KB (726,016 B) not raised |

## Mutation, `pnpm test:mutation:telemetry`

| Run | Score (floor 96) |
| --- | --- |
| full, 4,555 mutants | 96.8 |
| incremental, after tests for the survivors on changed lines | 97.2 |

Survivors of the first run on changed lines, and what became of them:

| Where | Mutant | Now |
| --- | --- | --- |
| `stored-usage-migration.ts` | `roots.size > 0` to `true` | killed: no `roots.json` is made where there was none |
| `stored-usage-migration.ts` | the null checks around `earlier !== now` | removed: both rules fall back to the root commit alike, so one is null only when both are; `if (earlier !== now)` is killed by a root with neither origin nor commit |
| `stored-usage-migration.ts` | `roots.sort(...)` dropped | removed: the table is a map written in text order, the order roots are located in changes nothing |
| `repository-aliases.ts` | the parse guards | killed: a unit test per damaged shape |
| `legacy-repository-identity.ts` | `address === null \|\| path === null`, `&&` | killed by a remote with a host and one segment |

Left, on changed lines, both equivalent:

| Where | Mutant | Why it cannot be killed |
| --- | --- | --- |
| `legacy-repository-identity.ts:9` | `address === null` to `false` | `path` is `null` whenever `address` is, so `path === null` returns the same |
| `binding-snapshot-store-adapter.ts:45` | `?? ""` to `?? "Stryker was here!"` | an absent file then reads as one line that is no snapshot, skipped: no snapshot either way. The line moved from `history()` and `latest()` into `read()` unchanged |

The other survivors in the touched files (`ingest-usage-use-case.ts` 88, 117, 121, 136; `usage-ledger-adapter.ts` 84, 121, 159; `claude-transcript-usage.ts` 42, 47) are on lines this change does not touch.

## After merging `next` (#1048): a migrated day kept the order it was found in

The fresh-ingest property failed in the pre-push run on the merge commit `ffe60df1`, seed `-554519443`. It fails the same way on `247ced3a`, before the merge (temporary worktree, same test): the merge did not cause it.

Counterexample, pinned as its own test ("puts a day it neither re-keys nor re-ids in the order one ingest writes"): calls 7 and 9 read before the migration in one batch, call 0 after. The earlier store wrote `2026-10-08.jsonl` in key order (`msg_7` at 12:00, then `msg_9` at 00:00:01). Neither call is re-keyed or re-ided, and no later read touches that day.

```txt
× puts a day it neither re-keys nor re-ids in the order one ingest writes, whatever order it was found in
  AssertionError: expected { …(3) } to deeply equal { …(3) }
-   "2026-10-08.jsonl": "{…\"key\":\"msg_9:req_9\"…}
+   "2026-10-08.jsonl": "{…\"key\":\"msg_7:req_7\"…}
```

**Root cause:** `StoredUsageMigration.execute` called `settleLedger`, which rewrites only the partitions a read finds unsettled (`application/ledger-upkeep.ts` `settleLedger`). `UsageLedgerAdapter.load` marks a day unsettled when a record changes or a call is held twice, never for line order. So a day the rules left alone kept whatever order it had. The contract said the first run rewrites every partition. A released writer always wrote time-then-key order (cli-v5.5.0 `partitionByDay`), so this needs a store no released CLI wrote, such as a hand edit or the test's emulation. It is still a gap between the code and the contract.

**Fix:** the migration saves every partition from one full load (`ledger.save(records)` with no partition list). `save` leaves a partition that already holds its canonical bytes untouched.

| Proof | Result |
| --- | --- |
| Pinned test, before the fix | red, above |
| Pinned test and the three properties, after | 4 of 4, in 15 runs with random seeds |
| Mutation G-j: rewrite only the unsettled and damaged partitions again | killed by the pinned test |
| Mutation G-e: no ledger rewrite | killed (3 tests) |

## Review round 1 (62/100): D1, M1, minors

### D1: how far apart are a requestless call's copies? Measured first

Read-only scan of the maintainer's own Claude Code transcripts (script outside the repository; only these aggregates are kept):

| Measure | Value |
| --- | --- |
| Transcript files, lines | 3,837; 2,147,449 |
| Usage lines (assistant, `message.usage`, not `<synthetic>`) | 512,820 |
| Of which with no `requestId` | 0 |
| Message ids with a request id, written more than once | 184,502 |
| Their widest spread between copies (any session) | 0.2687 h |

No requestless copy exists to measure, so no spread can be cited for them and the window cannot rely on one. **Decision:** keep M10 (`message.id:sessionId`) and fix it structurally. An ingest that stores a requestless call reads every day, not the days around it (`storeCalls`), so the ledger holds such a call once, whatever its spread, and a bounded read cannot see a copy the full read folds away. The window stays ±1 day for calls with a request id, the measured case. Cost: one full ledger load per ingest that meets a requestless line, which these transcripts never did.

Red run, before the fix (the probe's case pinned, both generators extended):

```txt
× finds its copy days away, so the ledger holds the call once and a bounded read agrees
  AssertionError: expected [ '2026-10-01.jsonl', …(1) ] to deeply equal [ '2026-10-04.jsonl' ]
× leave every bounded read equal to the full ledger filtered to its period
  Counterexample: [[{"anchor":5,"requestless":true,"copies":[{"days":0,…},{"days":3,…,"ingest":1}]}],{"from":null,"to":"2026-11-01"}]
  Caused by: AssertionError: expected [ { tool: 'claude-code', …(15) } ] to deeply equal []
```

The new window property generates requestless copies up to five days apart, stored by up to four ingests (requested copies stay within the measured half day). The migration property's times gain copies 3 and 9 days apart, for requestless and requested calls alike. Its run against the unfixed code passed: it compares full reports only, which fold every copy.

### M1: a root unreadable at the first run

The table now keeps `pending`: the roots that were `unreadable` or `gone`. A complete table with pending roots makes each later run locate those roots alone. When one adds an id, it rewrites `roots.json` and the ledger again. When none does, it writes nothing, or only the shorter `pending` once a root is no repository any more.

Red run, before the fix: 10 failed, 15 passed.

```txt
× maps a root it could not read at its first run once it can, so the repository keeps one id
  AssertionError: expected [] to deeply equal [ '/work/a' ]
× keeps a root gone at its first run pending, and drops one that is no repository now
× asks only the pending roots again, and writes nothing while none can be read
× reads back what it wrote, its ids in text order (and the table's other shapes, with `pending`)
```

The "drops one that is no repository now" second half was added after the fix. It is proven by mutation M1-g.

### Minors

| # | Change | Proof |
| --- | --- | --- |
| m1 | re-keying applies to `claude-code` records only | red before: `× re-keys only what Claude Code keyed so, never another tool's key`; mutation m1 killed |
| m2 | the contract says what a damaged table costs `branches.jsonl` | doc |
| m3 | first-run cost measured, below | no change needed |
| m4 | the migration (`IngestUsageUseCase`) and the alias store (`BindingSnapshotStoreAdapter`) are required. The ledger and `roots.json` adapters build theirs from their own directory, so no wiring can leave them out | `tsc` |
| m5 | `RepositoryIdMigration` reference fixed | - |
| m6 | `period.ts` states both bounds | - |

### m3: first-run cost against the hook's 110 s

Probe outside the repository, sandboxed `HOME`, real git: every root is a `git clone --shared` of this repository (1,077 commits), origin `git@github.com:Acme/Tool<n>.git`, so each needs an alias. The ledger has 365 days of records, one in ten with an earlier requestless key.

| Roots | Records | Ledger | `locate` per root | First run | Second run | Heap |
| --- | --- | --- | --- | --- | --- | --- |
| 50 | 250,000 | 112 MB | 29 ms | 4.5 s | 0 ms | 313 MB |
| 200 | 1,000,000 | 449 MB | 38 ms | 20.8 s | 1 ms | 1.4 GB |

Both stay well inside 110 s. The 250,000-record case is about half the usage lines found on the measuring machine, before folding. Progress is not split further.

### Hand mutations, round 2

Each applied alone, the named tests run, the file restored: 12 of 12 went red. D1-a to D1-d: the full read, the session test, the advisor suffix, the tool. m1. M1-a to M1-g: unreadable roots pending, gone ones too, a complete table with pending roots looks again, only the pending roots are asked, nothing new writes nothing, a dropped root is saved, `pending` kept in the file.

## Review round 2 (86/100): n1 to n5

| # | Change | Proof |
| --- | --- | --- |
| n1 | Requestless lines an older CLI writes after the migration are a stated limit. A bounded report may count such a copy until a report with no period settles the ledger. Stated in both contracts, with the Key row, the Read-time row and the older-CLI paragraph qualified | the window property now generates them (below) |
| n2 | six stale statements fixed: usage contract (Key row, day-file row, window paragraph), `usage-ledger-adapter.ts` header, CLI memory row, task contract (flowchart with pending roots, the measured 1,672 ms against 13 ms) | doc |
| n3 | one advisor pattern, `ADVISOR` in the Claude format, used by the re-keying too; the redundant guard in `StoredUsageMigration.execute` deleted (a complete table with nothing pending locates nothing and writes nothing) | `#advisor10` and `#advisor3` cases; mutation `\d+` to `\d` killed |
| n4 | the migration property's first run after the upgrade has up to two clones `unreadable` or `gone`, back by the next run; a failure at every write of a pending root's retry, then a rerun, equals a clean retry | mutations P-a and M1-h below |
| n5 | the ledger and `roots.json` adapters keep building their table from their own directory, with one line saying so: no wiring can leave it out | doc |

Red run, n1: the window property with an older CLI's requestless lines, before the exemption was named:

```txt
× leave every bounded read equal to the full ledger filtered to its period
  Counterexample: [[{"anchor":1,"requestless":true,"copies":[{"days":0,…,"older":false},{"days":2,…,"older":true}]},…],{"from":"2025-12-29","to":"2026-02-28"}]
  Caused by: AssertionError: expected [ Array(2) ] to deeply equal [ { tool: 'claude-code', …(15) } ]
```

After it, the property exempts the bounded read for the calls an older CLI stored a copy of, and only those. It still asserts one record per call in the full read for every call.

The n3 two-digit case, the n4 generator and the retry test passed against the code as it stood: the behaviour was right and unpinned. Each is proven by a mutation, all applied alone and killed:

| # | Mutation | Killed by |
| --- | --- | --- |
| n3 | `ADVISOR` `\d+` to `\d` | keeps an advisor iteration's suffix; is told by its key ending in its own session |
| P-a | an unreadable or gone root not kept pending | the fresh-ingest migration property |
| M1-h | the retry writes its table complete before the rewrite | stopped at any write of a pending root's retry; writes its table before anything else |

Re-run with them: D1-a to D1-d, m1, M1-a, M1-b, M1-d to M1-g, all killed again (M1-c gone with its guard).

## Review round 3 (90/100): r1 to r4

### r4 and r1: tests, each proven by a mutation applied alone, five runs each

| # | Test | Mutation | Runs killed |
| --- | --- | --- | --- |
| r4 | a fixed batch mixing a requestless call with one that has a request id; the requestless call's earlier copy is three days away | `incoming.some(isKeyedBySession)` to `every` | 5 of 5 |
| r4 | a table of another version, all else valid, is rejected | the version check dropped | 5 of 5 |
| r4 | a table whose completion is no boolean, all else valid, is rejected | the completion check dropped | 5 of 5 |
| r1 | the window property no longer skips a call an older CLI stored a copy of. It asserts the limit: the bounded read holds the call exactly once when a day of its window holds a copy of it on disk (read off the files, not through the adapter), never otherwise; the full read holds it once | a bounded read drops re-keyed lines (`usage-ledger-adapter.ts:96`) | 5 of 5 |
| r1 | same | every read drops re-keyed lines | 5 of 5 |

These tests passed against the code as it stood: the behaviour was right, but before them the r4 trigger was pinned only by chance, and the r1 exemption hid an undercount.

### r3: Stryker on exactly the changed lines, under the lock

`node scripts/run-mutation.mjs --changed <base>` mutates the `git diff -U0` ranges of `cli/src` since the merge base. The first runs:

```txt
--changed 57169330:   Report: reports/mutation/changed/ (score 98.8, 31 changed range(s) since 57169330)
--changed origin/next: Report: reports/mutation/changed/ (score 97.2, 44 changed range(s) since origin/next)
```

The `origin/next` run left 7 survivors. Two were not equivalent; tests were added for both (commit `8086176b`), each proven by a mutation applied alone:

| Survivor | Now |
| --- | --- |
| `legacy-usage-key.ts:17` `base.length > earlier.length` to `>=`, and to `true` | killed: a key that is only `:session:at` is no earlier key to strip |
| `usage-ledger-adapter.ts:96` the re-keyed partition no longer marked unsettled (two mutants) | killed: a day holding an older CLI's timestamped key is rewritten when it is settled. The migration's full save had hidden it since `57169330` |

Final runs, after `8086176b`:

```txt
--changed 57169330:   Instrumented 11 source file(s) with 83 mutant(s); Report: reports/mutation/changed/ (score 98.8, 31 changed range(s) since 57169330)
--changed origin/next: Instrumented 15 source file(s) with 252 mutant(s); Report: reports/mutation/changed/ (score 98.8, 44 changed range(s) since origin/next)
```

Survivors left, all equivalent:

| Survivor | Why it cannot be killed |
| --- | --- |
| `claude-transcript-usage.ts:16` `/#advisor\d+$/` to `/#advisor\d+/` | `#advisor<n>` is only ever written as a key's suffix; message and session ids hold no `#` |
| `repository-aliases.ts:20` `text ?? ""` to `?? "Stryker was here!"` | a missing file then parses as no JSON, and `null` is returned either way |
| `legacy-repository-identity.ts:9` `address === null` to `false` | `path` is `null` whenever `address` is |

The checker's 95.11 (11 survivors) mutated whole line ranges, including lines this change does not touch, such as `claude-transcript-usage.ts:20-62` and `ingest-usage-use-case.ts:89`. The two figures measure different scopes.



## Review round 4 (94/100): r1b, r5, r6

### r1b: a bounded read must keep the full read's copy

The window property counted the records of a call an older CLI also stored, but never compared them. It now asserts, for each such call whose full-read record lies in the period, that the bounded read's record deep-equals it: its day is then in the window, and the window's fold keeps that same copy. The limit allows over-counting only.

The checker's mutant, applied alone before `usage-ledger-adapter.ts:96`:

```ts
if (record !== read && holds !== undefined && heldIn.has(`${record.tool}\u0000${record.key}`)) continue;
```

| Test | Runs |
| --- | --- |
| window property as committed in `102baf98` | survived 3 of 3 |
| window property with the content check (`8dee6830`) | killed 3 of 3: `× leave every bounded read equal to the full ledger filtered to its period` |

The `$` anchor of `ADVISOR` now carries a comment saying it is there for clarity only.

### Hand mutations, all rounds, counted as mutants

The 47 counts the hand mutations, each one replacement applied alone; all were killed. Two rows of the round-3 survivor table hold two Stryker mutants each (`>=` and `true`; the two at `:96`), all four killed too.

| Round | Mutants |
| --- | --- |
| First build | 23 (M7-a to M7-e, M10-a, K-a to K-c, L-a, L-b, R-a, S-a, G-a to G-i, I-a) |
| Canonical day order (`57169330`) | 1 (G-j) |
| Review round 1 | 12 (D1-a to D1-d, m1, M1-a to M1-g) |
| Review round 2 | 3 (`ADVISOR` `\d+` to `\d`, P-a, M1-h) |
| Review round 3 | 7 (mixed batch, version check, completion check, two re-keyed-line drops, `>=` on a bare session key, the unsettled mark) |
| Review round 4 | 1 (r1b) |

## Gates at the last code commit (`8dee6830`)

| Gate | Result |
| --- | --- |
| `cd cli && pnpm test` | `Test Files 522 passed | 1 skipped (523)`, `Tests 6813 passed | 1 skipped (6814)` |
| `node --test 'scripts/__tests__/**/*.test.js'` | 461 tests, 461 pass, 0 fail |
| `pnpm build` | `Bundle size: 700.6 KB / budget: 709 KB`; `dist/cli.js` 717,408 B of 726,016 B |
| `pnpm smoke` | `PASS: 132   FAIL: 0   SKIP: 1   ·   coverage 100%` |
| `node scripts/check-claude-tokens-end-to-end.cjs cli/dist/cli.js` | `2 calls, 393 tokens, all on task demo, ticket T-1, and on task demo in this repository` |
| same, `--attended` | same, then `asked, answered by the hook, kept across /clear` |
| `pnpm test:mutation:telemetry`, full scope, before the review fixes | 97.2 (see above) |
| Stryker, changed lines, after `8086176b` | 98.8 since `57169330` (83 mutants), 98.8 since `origin/next` (252 mutants) |
