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
