---
status: done
---

# Plan: Codex is measured

Contract: `contract.md`. Each phase starts with its tests, run red first, the red run recorded in `evidence.md`.

## Phase 1: the format

- `contexts/telemetry/domain/formats/codex-transcript-usage.ts`: a reader made once per file read, holding that file's context, mapping a line to records and unrecognised shapes as the contract's table says.
- Unit tests over synthetic lines: the mapping, first `session_meta` wins, latest `turn_context` wins, a line before the offset builds context and gives nothing, the unrecognised cases, the running totals ignored, P2.
- Acceptance: every row of the contract's table has a test that fails when its rule is broken.

## Phase 2: the source and the read from the start

- The Claude Code source's block reader shared, not copied, with a Codex source that lists both roots, reads `.jsonl` from the start once moved, and reads `.jsonl.zst` through a streamed decompression.
- `ReadUsageUseCase` hands the format whether each line is past the saved offset; the Claude Code format ignores it.
- Integration tests: resume with context (the ingest, append to the turn and to a new turn, ingest again case), compressed file, no-zstd runtime, P3.
- Acceptance: `offsets.json` unchanged in format; the Claude Code adapter's tests unchanged and green.

## Phase 3: wiring, properties, docs

- One reader more in `runtime/wiring/telemetry.ts`, root from `CODEX_HOME` or the home directory.
- Every test and script that runs the CLI against a relocated home also relocates `CODEX_HOME`.
- P1 as a fast-check property; P4 by adding Codex records to the existing generators.
- Docs: the usage contract (scope, record source, limits), the plugin README, the 01-usage skill and its envelope reference, `cli/aidd_docs/memory/telemetry.md`, both `cli.md`, both project briefs where they say Claude Code only.
- Acceptance: the full gate list in `evidence.md` green.
