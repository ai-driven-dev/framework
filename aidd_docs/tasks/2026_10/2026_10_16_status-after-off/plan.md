---
objective: "After `off`, status and task say measurement was turned off in this clone and how to turn it back on; a clone that never ran `on` keeps today's words."
status: done
---

# Plan: Status after `off` says measurement was turned off

## Overview

| Field      | Value                   |
| ---------- | ----------------------- |
| **Goal**   | a `turned-off` refusal, read from the key `off`, worded for `status` and `task` |
| **Source** | [`contract.md`](./contract.md), issue #1035 |

One phase: the change is a domain variant, one branch, two words and a docs line.

## Steps

| # | Step | Files |
| --- | --- | --- |
| 1 | Tests first, seen red: the domain reads `off`, and only `off`, as turned off; status and declare refuse `turned-off` for `off` and keep `no-consent` for absent, `2`, `true`, `{}`; a damaged log or an unidentified clone beats `turned-off`; both words exact; the lifecycle e2e runs `on`, `off`, `status`, `task` | `telemetry-consent` unit test, `telemetry-status-use-case`, `declare-task-use-case`, `telemetry-display` unit tests, `telemetry-lifecycle.e2e.test.ts` |
| 2 | `telemetry-consent.ts` says whether a key was turned off; `RefusalReason` gains `turned-off`; `ConsentedRepositories` maps it; the two word tables say it | `domain/telemetry-consent.ts`, `application/consented-repositories.ts`, `presentation/display/telemetry-display.ts` |
| 3 | Each guard proven by a mutation, reverted | `evidence.md` |
| 4 | Usage contract: what status says after `off` | `aidd_docs/product/usage-contract.md` |
| 5 | Gates and the sandboxed repro | `evidence.md` |

## Decisions

| Decision | Why |
| --- | --- |
| A domain function beside `CONSENT_WITHDRAWN`, not a `Consent` variant | `consentOf` is pinned to `absent` for `off` by the fixture the hooks share; the grammar still stays in the domain |
| `turned-off` is decided after the consent log is read | status never advises an `on` that would refuse (contract rule 3, review round 1) |
