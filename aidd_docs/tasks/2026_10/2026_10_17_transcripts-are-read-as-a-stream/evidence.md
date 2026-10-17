# Evidence

## Red runs

### Behavioural guards, on `origin/next` `1202ff53` code

`pnpm exec vitest run` on the adapter and `ReadUsageUseCase` tests, `-t "before the rest|more than a block"`, source untouched (only tests and the oracle helper written):

```txt
× never asks the file for more than a block, however long its unread tail
× hands its first lines to the line reader before the rest of it is read
AssertionError: expected 1 to be less than 1
AssertionError: expected 3145728 to be less than or equal to 1048576
Tests  2 failed | 29 skipped (31)
```

The whole 3 MiB tail is asked for in one read, and the line reader sees no line before it is done. Both fail on behaviour: the second test's line count (`3072`) passed on the old code before its ordering assertion failed.

## Guards, each turned red by a hand mutation

Each mutation applied alone to `eachLine` in `claude-transcript-source-adapter.ts`, then the adapter, `ReadUsageUseCase`, S1 and S2 tests run (`vitest run`, 43 tests), then restored.

| Mutation | Tests turned red |
| --- | --- |
| One block the size of the whole tail | never asks the file for more than a block; hands its first lines to the line reader before the rest of it is read; stops where a file truncated while it reads ends |
| Pieces of a split line dropped | joins a line split across blocks; decodes a character split across blocks; strips a CRLF split across blocks; leaves an unterminated last line; reads a line many blocks long; S1; S2 |
| Each piece decoded alone | decodes a character split across blocks; S1 |
| Carriage return kept | strips the carriage return of a CRLF line; strips a CRLF split across blocks; S1; S2 |
| Reads a full block past the size stat'd | reads up to the size it found, not what is appended while it reads (green at first with blocks of 4 and a 12-byte file; the test now uses blocks of 5 and turns red) |
| No stop at a short read | stops where a file truncated while it reads ends (times out) |
| Unterminated line consumed | does not consume an unterminated last line; leaves an unterminated last line; S1; S2 |
| Empty line not handed over | hands empty lines over as lines; S1; S2 |
| No floor on the block size (`size - from` may be negative) | reads nothing past the size when its saved offset is beyond it; S1 |
| A short read counted as reaching the size | stops where a file truncated while it reads ends |
| Consumed starts one past the offset | reads nothing from an empty file; reads nothing past the size when its saved offset is beyond it; S1; S2 |
| Loop runs once more at the end (`at <= size`) | none: the extra read asks 0 bytes and breaks, equivalent (also left alive by Stryker, below) |
| Partial piece not copied before the block is reused | joins a line split across blocks; decodes a character split across blocks; strips a CRLF split across blocks; leaves an unterminated last line; reads a line many blocks long; S1; S2 |

## S2 is not vacuous

One throwaway run of S2, instrumented and not committed, counted its ingest steps: 227 steps over 80 runs; 43 stored at least one call (`added > 0`), 23 met a call whose consent could not be read, and 16 saved an offset short of the transcript's last complete line, which only the #1046 hold-back does. Ledger days, the hold-back and `left-out.txt` are all exercised.

## Memory

Generated transcript of synthetic lines (fake ids, about 2 KB each, one usage line in 50), in the scratchpad, deleted after. `ReadUsageUseCase` with the real adapter and `readClaudeUsageLine`, bundled with esbuild from `origin/next`'s source and from this branch's, each in its own `node` process (v24.20.0) under `/usr/bin/time -l`, one at a time.

| Run | Transcript | Records | Offset saved | Max RSS |
| --- | --- | --- | --- | --- |
| `node -e 0` | none | - | - | 45,776,896 B (44 MB) |
| `origin/next` | 158,520,954 B (151 MB) | 1,580 | 158,520,954 | 390,070,272 B (372 MB) |
| this branch | 158,520,954 B (151 MB) | 1,580 | 158,520,954 | 69,402,624 B (66 MB) |
| this branch | 421,389,954 B (402 MB) | 4,200 | 421,389,954 | 80,478,208 B (77 MB) |

Before, peak memory grew with the tail: about 2.2 times the 151 MB transcript above the bare process. After, it stays some 25 to 35 MB above it at 151 MB and at 402 MB. `origin/next` was not run on the 402 MB file: by the ratio above it would need about 900 MB (inferred, not run), over what this machine can spare.

## Mutation

`pnpm test:mutation:telemetry` under the lock: first run 96.5 (floor 96). Two mutants on touched lines survived, `restarted: true` for a vanished file and for one skipped as old; `13a0ee62` asserts both (each hand-mutated red first). Second run: **96.6**.

Mutants still alive in `claude-transcript-source-adapter.ts` (`read-usage-use-case.ts`: 20 killed of 20):

| Line | Mutant | Why it lives |
| --- | --- | --- |
| 48 | block sized `size + from` instead of `size - from` | only allocates more than the range needs; every read still asks `min(block, size - at)`: same bytes, same lines |
| 51 | `at <= size` | at `at === size` the read asks 0 bytes, gets 0, and the loop breaks: equivalent |
| 65 (two) | `start <= bytesRead`, `true` | pushes an empty piece, which joins to nothing: equivalent |
| 22, 27, 29, 99, 135 | identity, `lastLineEnd`, `oldestModified`, `finally` | lines this change does not touch |

## Bundle

`dist/cli.js` 712,435 B, `Bundle size: 695.7 KB / budget: 709 KB`. No raise.

## Gates, on `13a0ee62` (the commits after it change only this folder)

Every CLI and hook run with `HOME`, `XDG_CONFIG_HOME`, `AIDD_USER_CONFIG_DIR`, `AIDD_TELEMETRY_DIR`, `CLAUDE_CONFIG_DIR` in temporary directories and `GIT_CONFIG_NOSYSTEM=1`.

| Gate | Result |
| --- | --- |
| `cd cli && pnpm test` | `Test Files 514 passed \| 1 skipped (515)`, `Tests 6736 passed \| 1 skipped (6737)`. A first run, before `13a0ee62`, failed one test: `comments.arch.test.ts` flagged an issue number and a commit hash in two new test comments; both removed |
| `node --test 'scripts/__tests__/**/*.test.js'` | `tests 460`, `pass 460`, `fail 0` (run on `1522c00d`; `13a0ee62` touches only a CLI test) |
| `pnpm test:mutation:telemetry` | score 96.6, floor 96 |
| `pnpm smoke` | `PASS: 132 FAIL: 0 SKIP: 1 · coverage 100%` |
| `node scripts/check-claude-tokens-end-to-end.cjs cli/dist/cli.js` | exit 0, `2 calls, 393 tokens, all on task demo, ticket T-1, and on task demo in this repository` |
| same, `--attended` | exit 0, same, `; asked, answered by the hook, kept across /clear` |
| `pnpm lint`, `pnpm typecheck` | run by the pre-commit hook of every commit (exit 0). Run by hand before `1522c00d`: lint clean but one warning in `uninstall-use-case.ts`, present on `origin/next` |
