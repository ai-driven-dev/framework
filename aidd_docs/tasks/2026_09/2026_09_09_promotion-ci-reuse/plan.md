---
objective: "A next-to-main promotion and its resulting main merge reuse an already-passing mutation gate only when the exact tested tree is proven unchanged."
status: implemented
---

# Plan: Reuse validated next CI through promotion

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Remove duplicate mutation matrices from promotion and its resulting `main` merge without weakening any gate. |
| **Source** | User request: strict SDLC after the CI-wide challenge. |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Reuse a validated promotion snapshot | [`phase-1.md`](./phase-1.md) |
| 2 | Lock the workflow contract | [`phase-2.md`](./phase-2.md) |
| 3 | Bind promotion reuse to the tested merge tree | [`phase-3.md`](./phase-3.md) |
| 4 | Reuse the proven promotion merge on `main` | [`phase-4.md`](./phase-4.md) |

## Resources

| Source | Verified |
| --- | --- |
| https://docs.github.com/en/rest/actions/workflow-runs | Workflow runs can be filtered by branch, event, and head SHA with Actions read permission. |
| https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows | A pull-request checkout uses the synthetic merge ref, so a promotion-specific smoke can validate the merged result. |
| Repository evidence: PR #809 | Its merge tree equalled the promoted `next` snapshot, but that invariant was convention-only rather than enforced. |

## Decisions

| Decision | Why |
| --- | --- |
| Reuse only a successful `push` run for the exact snapshot SHA on `next`. | The promotion source has already satisfied `next`'s required gate; absent or unsuccessful proof must not bypass mutations. |
| Keep all non-mutation jobs on the promotion PR merge ref. | Coverage, smoke, build, and platform checks still validate the merge of release metadata from `main`. |
| Require the promotion PR base to be an ancestor of its snapshot before reuse. | A previously green `next` run is insufficient if `main` contributes untested content to the PR merge tree. |
| On a `main` push, require both the matching promotion PR and tree equality with its snapshot. | A matching source SHA alone cannot prove that the merge commit carries the same content. |
