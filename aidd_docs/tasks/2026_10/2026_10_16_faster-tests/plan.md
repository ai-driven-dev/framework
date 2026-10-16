---
objective: "The telemetry mutation run and the CLI suite take less time, with every guard as strong as before."
status: done
---

# Plan: Faster mutation and test runs, guards unchanged

## Overview

| Field      | Value                   |
| ---------- | ----------------------- |
| **Goal**   | Mutation runs the cheap killer first and stops treating collection-time calls as static; `pnpm test` loses its single-file critical path and a third golden capture |
| **Source** | [`contract.md`](./contract.md), issue #1036 |

## Steps

Each step is measured before the next one starts, and lands as its own commit.

| # | Step | Files | Measure |
| --- | --- | --- | --- |
| 0 | Baseline: three `pnpm test` runs, one `--force` telemetry mutation run, load sampled | none | wall times, report kept for the per-mutant comparison and as a noise floor against the given report |
| 1 | Mutation-only sequencer: `unit` before `integration`, smallest file first, path last | `cli/tests/helpers/mutation-sequencer.ts`, its unit test, `cli/vitest.mutation.config.ts` | file start order under the mutation config before and after; full telemetry run; canary |
| 2 | Collection-time calls into product code moved into the tests that use them | the telemetry test files the static sweep names | static count and per-mutant comparison on a full run |
| 3 | Stryker `timeoutMS`, `timeoutFactor`, `concurrency`, measured on one telemetry shard | `cli/stryker.conf.json` or a per-scope override, only if a setting wins | shard wall time and status changes per setting |
| 4 | Split `telemetry-report.e2e.test.ts` by `describe`, fixture in a helper | `cli/tests/e2e/telemetry-report*.e2e.test.ts`, a helper beside them | `pnpm test` wall time, same test count |
| 5 | Golden: two captures, the first compared to the baseline | `cli/tests/golden/framework-build-golden.e2e.test.ts`, `cli/tests/golden/golden-baseline.e2e.test.ts` | `pnpm test` wall time; the update path still writes a capture |
| 6 | Whatever else the measurements show | as measured | as measured |
| 7 | Docs, gates, evidence, status done | `cli/aidd_docs/memory/testing.md`, `evidence.md` | every gate green |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| The sequencer extends Vitest's `BaseSequencer` and overrides `sort` only | sharding inside Vitest is unused by Stryker; Stryker shards by mutated file, so the order applies per shard as is |
| Both projects keep `sequence.groupOrder` 0 | with `maxWorkers: 1` and isolation, Vitest keeps the sorted order in one sequential group, so the sort alone decides |
| Measured runs pass `--force` | an incremental file from an earlier run would reuse every kill and time nothing |
| A per-mutant comparison keys on file, position, mutator and replacement, not on id | ids are not stable across runs |
