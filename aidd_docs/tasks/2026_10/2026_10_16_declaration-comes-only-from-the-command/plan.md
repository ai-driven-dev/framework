---
objective: "A branch is bound only by a declaration the command made on that branch, in the CLI and in the hook alike, and the contract says what the gate does."
status: done
---

# Plan: A declaration comes only from the command

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Hand-set, copied or renamed declaration keys bind nothing; legacy declarations still read; M8 doc fixed |
| **Source** | [`contract.md`](./contract.md), R1 telemetry audit (B1, M8), no issue |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | The CLI writes the stamp and reads only the command's declaration | [`phase-1.md`](./phase-1.md) |
| 2   | The hook reads by the same rule, from the shared fixture | [`phase-2.md`](./phase-2.md) |
| 3   | Contract, memory, plugin docs, gates | [`phase-3.md`](./phase-3.md) |

## Decisions

| Decision | Why |
| --- | --- |
| The stamp is a filter at config read, never stored in `BranchConfigBinding` or a snapshot | `branches.jsonl` keeps its format, no migration |
| An undeclared branch is left out of `parseBranchConfig`'s result | Nothing to snapshot, nothing to bind; `status` and attribution need no change of their own |
| The shared fixture `scripts/__tests__/fixtures/telemetry-bindings/` pins the rule | Both readers already run it; one case file, two tests |
