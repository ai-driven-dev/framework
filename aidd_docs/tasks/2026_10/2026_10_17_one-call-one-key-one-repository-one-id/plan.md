---
objective: "One call is one key and one repository is one id, in new data and in data already stored."
status: done
---

# Plan: One call, one key; one repository, one id

## Overview

| Field | Value |
| --- | --- |
| **Goal** | M7 and M10 of the R1 telemetry audit closed, stored data migrated, envelope untouched |
| **Source** | [`contract.md`](./contract.md) |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | The identity rule (M7) | [`phase-1.md`](./phase-1.md) |
| 2 | The key rule (M10) | [`phase-2.md`](./phase-2.md) |
| 3 | Stored data migrated | [`phase-3.md`](./phase-3.md) |
| 4 | Docs and gates | [`phase-4.md`](./phase-4.md) |

## Decisions

| Decision | Why |
| --- | --- |
| Case-fold owner and repo on `github.com` only | the only host with a primary source; elsewhere a split is safer than a merge |
| `message.id:sessionId`, `requestId` keys untouched | the asked fix; re-keying every call would orphan every `undated` hash |
| Read-time rules plus a one-off rewrite | figures are right in any half-migrated state and after an older CLI writes again; the rewrite makes the disk say it too |
| An alias table, not a re-hash | a stored id is a hash: only a live clone's `origin` can say what it was |
| `branches.jsonl` aliased at read, never rewritten | it stays append-only, and needs no second lock |
| Hooks unchanged | they compute no repository id and no key |
