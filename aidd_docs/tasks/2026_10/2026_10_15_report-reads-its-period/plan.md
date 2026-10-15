---
objective: "A report with a bounded period reads only the partitions that can hold a call of it, and prints the same figures as a full read."
status: done
---

# Plan: A report reads its period

## Overview

| Field      | Value                   |
| ---------- | ----------------------- |
| **Goal**   | `--days 7` costs its days, not the whole history; no figure changes |
| **Source** | [`contract.md`](./contract.md) |

## Phases

| #   | Phase        | File                         |
| --- | ------------ | ---------------------------- |
| 1   | The ledger loads by a test on the day | [`phase-1.md`](./phase-1.md) |
| 2   | A bounded report loads and settles its window | [`phase-2.md`](./phase-2.md) |
| 3   | Docs, measures and gates | [`phase-3.md`](./phase-3.md) |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| `UsageLedger.load` takes `(day) => boolean` instead of a set of days | a window open on one side, or `--from 0001-01-01 --to 9999-12-31`, would otherwise build a set as long as the period; a test costs the partitions on disk |
| No summary or cache | the breakdown in the contract shows no dominant stage; a second state is not justified |
