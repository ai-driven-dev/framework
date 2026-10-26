# Evidence

## Census of real Codex session files

Read-only, over one machine's `~/.codex/sessions`, Codex CLI 0.149 to 0.162. Aggregates only: no id, path or content is recorded here. The probe scripts stayed in the scratchpad.

| Fact | Measured |
| --- | --- |
| Plain session files, size | 476 `.jsonl`, 2,161 MB, the largest 723 MB |
| Longest line | 6.9 MB |
| Lines that are not JSON, split strictly on byte `0x0a` | 0 of 470,948. Node `readline` also splits on U+2028 and U+2029 and turned 224 lines into fragments: the reader splits on `0x0a` only |
| `token_usage_record` lines | 56,317 |
| ... with `response_id`, `session_id`, `thread_id`, `usage` | all |
| ... `response_id` repeated, in one file or across files | 0 |
| ... `total_tokens = input_tokens + output_tokens` | all |
| ... `cached_input_tokens ≤ input_tokens` | all |
| ... `reasoning_output_tokens ≤ output_tokens` | all |
| ... `cache_write_input_tokens > 0` | 0 |
| ... `thread_id ≠ session_id` | 17,904, all in sub-agent files (`session_meta.source.subagent.thread_spawn`); 0 elsewhere |
| ... with a `turn_context` of the same turn before it | 56,304; the other 13 have an earlier turn's |
| ... latest `turn_context` before it agrees with the same turn's, model and cwd | all, 0 differences |
| Files with two `session_meta` | 186, all sub-agent files: the first is the file's own, the second its parent's |
| `session_meta` with `git.branch` | 367 of 473 |
| Running totals (`event_msg` `token_count`) | 60,190 lines: not calls. Their last value differs from the sum of calls in 65 files, 64 of them compacted |
| Full `JSON.parse` of every line of every file | 2.9 s, the largest file 0.8 s, 263 MB resident |
| Compressed files `rollout-*.jsonl.zst` | 1,056, holding 19,147 calls; none has a `.jsonl` twin |
| When a file is compressed | by day folder: none of the last ten days, most of the older ones, a few older `.jsonl` left (sessions still resumed) |
| Archived sessions (`~/.codex/archived_sessions`) | 5 `.zst` files, flat |

## Red run

Each test was run red first, failing on the assertion it names, before the code it covers existed or with that code broken on purpose.

| Guard | Broken how | What went red |
| --- | --- | --- |
| The format, every row of the table (`codex-transcript-usage.unit.test.ts`) | reader stubbed to give nothing | 29 of 32 tests failed on their assertions; the 3 that passed assert "gives nothing" |
| A moved `.jsonl` read from its start | read from the saved offset, as Claude Code's is | adapter "reads a grown file from its start…", use case "gives a call written after a resumed read the directory and model…", P1 |
| Lines before the offset counted once | the use case keeps outcomes of uncounted lines | use case resume test, P1 (counts and ledger) |
| `counted` computed by the shared splitter | `counted = true` | adapter grown-file test, use case resume test |
| A `.zst` read once | re-read whatever its position | adapter "keeps the file read by its size and identity" |
| The no-zstd shape reaches the run | the source's `unrecognised` dropped by the use case | use case "names each compressed file a Node with no zstd cannot read" |

Review round 1, red first:

| Guard | Broken how | What went red |
| --- | --- | --- |
| A `.zst` that does not decompress stops nothing (adapter, and an ingest beside a Claude Code transcript) | before the fix | both tests, on `Error: Unknown frame descriptor` |
| Only zlib's own codes are passed over | the code check removed | adapter "fails the read: only a stream that does not decompress is named and passed over" (an `EACCES` open) |
| The file keeps its position, so it is tried again | a made-up position saved | adapter "…when it does not decompress, and is read again next time", and the no-zstd test |
| The sandbox points `CODEX_HOME` inside it | the relocation removed from `sandboxedEnv` | "points Codex's home inside the sandbox, even when the runner sets its own" |

P3 (plain then compressed) passes under the re-read-every-time break: the ledger takes a key once whatever reads it, which is what P3 states; the re-read itself is killed by the adapter test.

## Verification

### Real corpus, read-only

The CLI's Codex source and format, bundled into a scratchpad script, read `~/.codex/sessions` and `~/.codex/archived_sessions` from byte 0 with no saved position; nothing was written there. The independent probe shares no code with the CLI. Both were run back to back, twice, on a corpus still being written:

| Measure | Independent probe | CLI reader |
| --- | --- | --- |
| Files | 1,537 | 1,537 (1,061 `.zst`) |
| Distinct calls | 75,584 | 75,584 records after the fold |
| Tokens (`total_tokens` / `input + output + cache_read + cache_write`) | 9,313,648,283 | 9,313,648,283 (P2 over the corpus) |
| Threads whose per-call sum equals Codex's own `thread_token_usage` on the last call | 617 of 618 | 617 of 618, all five counters |
| The one other thread | running total already 370,167,606 on its first call | same thread: a history with no per-call records, a written limit |
| Unrecognised shapes | - | 0 |

The coordinator's earlier count (75,579 calls, 9,313,057,550 tokens) was taken before the files grew: the CLI read 75,581 and then 75,582 records on the way, and the two agreed on every run made back to back.

### Gates

| Gate | Decisive line |
| --- | --- |
| `pnpm exec lefthook run pre-commit` | every job green on each commit; `cli-architecture` once timed out (`mutation-covers-source.arch.test.ts`, 6 s against the 5 s default while `scripts-tests` ran beside it) and passed alone and on the retried commit |
| `pnpm lint` (cli) | `No fixes applied.`, the one warning is in `uninstall-use-case.ts`, untouched |
| `pnpm typecheck` | `tsc --noEmit`, no error |
| `pnpm test:arch` | `Tests 168 passed (168)` |
| `node scripts/check-cli-type-honesty.mjs` | `No type is widened through unknown, any or never` |
| `pnpm knip` | no finding |
| `pnpm jscpd` | exit 0, `1.55%` duplicated, threshold 3.3, no clone in a changed file |
| `pnpm test` | `Test Files 525 passed \| 1 skipped`, `Tests 6834 passed \| 1 skipped`; the one skipped file is none of the telemetry ones |
| `pnpm build` | `Bundle size: 704.7 KB / budget: 709 KB` |
| `pnpm smoke` | `PASS: 132 FAIL: 0 SKIP: 1 · coverage 100%` |
| `check-claude-tokens-end-to-end.cjs` | `2 calls, 393 tokens, all on task demo, ticket T-1` |
| `check-claude-tokens-end-to-end.cjs --attended` | same, `asked, answered by the hook, kept across /clear` |
| `node scripts/check-no-local-paths.js` | `0 leak(s)` |
| `run-mutation.mjs --changed` | score 96.5 over 21 changed ranges, survivors below |
| `run-mutation.mjs telemetry` | score 97.2, floor 96 |

### Mutants left alive on the changed lines

The first changed-line run scored 95.0. The five survivors in Codex code were killed by tests added for them: the rollout name pattern's `^`, `$` and `.*`, the source's `oldestModified`, and a `session_meta` after a `turn_context`. What survives is equivalent, or lies in code moved unchanged out of the Claude Code adapter:

| Where | Mutant | Why it lives |
| --- | --- | --- |
| `transcript-files.ts` `identityOf` | the `ino === 0` branch | Windows only: an inode is never 0 on the platforms the suite runs on |
| `lastLineEnd` | `end > 0` to `>=`; `end - from` to `+` | equivalent: at 0 the block is empty and the loop ends; a larger block only reads bytes already searched or past the end |
| `LineSplitter.push` | the one-piece fast path off; an empty remainder kept | equivalent: the joined bytes decode to the same line |
| `eachLine` | `size - from` to `+`; `at < size` to `<=` | equivalent: each read is capped at what is left, and a read at the end returns 0 bytes and stops |
| `oldestModifiedOf` | `<` to `<=` | equivalent: an equal time replaces itself |
| `readTranscript` | the `finally` that closes the handle emptied | not observable through the port: the handle is an own property, not on a prototype a test can spy on, and Node closes a leaked one on collection |
| `line-values.ts` `counter` | `typeof value === "number"` dropped | equivalent: `Number.isInteger` is false for every non-number |

### Review round 1

The gates above were run again after the fixes, in one pass:

| Gate | Decisive line |
| --- | --- |
| `pnpm lint`, `pnpm typecheck`, `pnpm test:arch` | `No fixes applied.`; no error; `Tests 168 passed (168)` |
| `check-cli-type-honesty.mjs` (repository root) | `No type is widened through unknown, any or never` |
| `pnpm knip`, `pnpm jscpd` | exit 0; `1.55%` duplicated |
| `pnpm test` | `Tests 6840 passed \| 1 skipped` |
| `pnpm build` | `Bundle size: 704.9 KB / budget: 709 KB` |
| `pnpm smoke` | `PASS: 132 FAIL: 0 SKIP: 1 · coverage 100%` |
| `check-claude-tokens-end-to-end.cjs`, plain and `--attended` | `2 calls, 393 tokens, all on task demo, ticket T-1` in both, the second `asked, answered by the hook, kept across /clear` |
| `check-no-local-paths.js` | `0 leak(s)` |
| `run-mutation.mjs --changed` | score 96.3 over 22 changed ranges |
| `run-mutation.mjs telemetry` | score 96.6, floor 96 |
| The checker's case, against the built binary in a sandbox | 100 random bytes as a `rollout-*.jsonl.zst` in a clone that opted in: `report --json` exits 0 with `unrecognised_shapes` 1, twice in a row; `ingest` exits 0 and names it |

New survivor on the changed lines, beside the ones justified above: `UNDECOMPRESSABLE` without its `^` anchor. It is equivalent for every code a read meets: an I/O code never holds `Z_` or `ZSTD_`. The `ZSTD_` and `Z_` prefixes are each held by a test (`ZSTD_error_prefix_unknown`, `Z_BUF_ERROR`).

The telemetry scope fell from 97.2 to 96.6 over the round, still above its floor of 96.

### Review round 2: a cut frame on Node 22

CI runs Node 22, where `createZstdDecompress` ends a cut frame with no error and short output: a truncated `.zst` was read as whole, its position saved, its missing calls lost. Node 24 fails the same stream with `Z_BUF_ERROR`. Every real compressed file is one frame declaring its content size, equal to its decompressed length (measured by the coordinator, read-only), so the reader counts the decompressed bytes against that size.

Red first, with the frame header reader stubbed to declare nothing:

| Node | Red |
| --- | --- |
| v24.20.0 | the 7 header-reading unit tests, and "names a stream that ends short of the size its frame declares" (a decompressor that ends one byte short, as Node 22's does) |
| v22.18.0 | the same 8, plus "names a stream cut short and reads it again next time…": the CI failure, reproduced |

The size check removed on purpose: "ends short" goes red on v24.20.0, "ends short" and "cut short" on v22.18.0.

Green after the fix, `npx vitest run tests/contexts/telemetry`:

| Node | Result |
| --- | --- |
| v24.20.0 | `Test Files 78 passed (78)`, `Tests 1388 passed (1388)` |
| v22.18.0 | `Test Files 78 passed (78)`, `Tests 1388 passed (1388)` |

Real corpus again, read-only, after the fix: the independent probe and the CLI reader give 1,537 files, 75,588 calls, 9,314,170,585 tokens, the same on both Node versions, with 0 unrecognised shapes: no real file fails the size check.

A file of several frames: `zlib` decodes the first alone on both versions, so the reader cannot see more than the first frame declares. Never seen; a written limit.

Gates after round 2, in one pass:

| Gate | Decisive line |
| --- | --- |
| `pnpm lint`, `pnpm typecheck`, `pnpm test:arch` | `No fixes applied.`; no error; `Tests 168 passed (168)` |
| `check-cli-type-honesty.mjs` (repository root) | `No type is widened through unknown, any or never` |
| `pnpm knip`, `pnpm jscpd` | exit 0; `1.55%` duplicated |
| `pnpm test`, Node v24.20.0 | `Test Files 526 passed \| 1 skipped`, `Tests 6851 passed \| 1 skipped` |
| `pnpm test`, Node v22.18.0 | `Test Files 526 passed \| 1 skipped`, `Tests 6851 passed \| 1 skipped` |
| `pnpm build` | `Bundle size: 706.0 KB / budget: 709 KB` |
| `pnpm smoke` | `PASS: 132 FAIL: 0 SKIP: 1 · coverage 100%` |
| `check-claude-tokens-end-to-end.cjs`, plain and `--attended` | `2 calls, 393 tokens, all on task demo, ticket T-1` in both |
| `check-no-local-paths.js` | `0 leak(s)` |
| `run-mutation.mjs --changed` | score 96.8 over 23 changed ranges; the frame reader's survivors were killed by tests added for them, the one left is the anchor-less `UNDECOMPRESSABLE` justified above |
| `run-mutation.mjs telemetry` | score 96.7, floor 96 |

`Z_BUF_ERROR` is held by a test on Node 24 only: on Node 22 a cut frame reaches the size check instead, so a mutation run on Node 22 leaves the `Z_` prefix of `UNDECOMPRESSABLE` to the code alone.

### Review round 3: Codex's own source

A `compacted` line embeds a copy of the latest record as `payload.latest_token_usage_record`. A unit test pins that it gives no record, no unrecognised shape and no `named`; it passed as written, and goes red, with two other "gives nothing" tests, when the top-level type check is dropped. Format tests: `Tests 69 passed (69)` on Node v24.20.0 and on v22.18.0. The usage contract's Codex limits now follow Codex's source: per-call records from 0.153, the calls Codex writes no record for, the cost fields not in the file, cache writes, a frame with no size before 0.152, coexisting copies, forks.
