---
objective: "Service access verification lives in its own read-only aidd-context skill driven by project memory, 02-project-memory is back to memory only, and connect-services.md addresses the PR #1026 review."
status: in-progress
---

# Plan: Move service access verification into `aidd-context:13-access-check`

## Overview

| Field      | Value                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| **Goal**   | Extract `verify` from `02-project-memory` into a dedicated skill and apply the review findings on the recipe |
| **Source** | PR #1026 (`ad4b8325`) and blafourcade's review of 2026-10-15                                             |

## Phases

| #   | Phase                                   | File                         |
| --- | --------------------------------------- | ---------------------------- |
| 1   | Create the `13-access-check` skill      | [`phase-1.md`](./phase-1.md) |
| 2   | Restore `02-project-memory` to memory only | [`phase-2.md`](./phase-2.md) |
| 3   | Apply the review to `connect-services.md` | [`phase-3.md`](./phase-3.md) |
| 4   | Record the change and prove it end to end | [`phase-4.md`](./phase-4.md) |

## Resources

| Source                                               | Verified                                                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| https://github.com/ai-driven-dev/framework/pull/1026 | review findings: scope too wide, relative path, API/SDK examples, client coverage, error handling |

## Decisions

| Decision                                                                 | Why                                                                                                                                     |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| A dedicated skill `13-access-check` in `aidd-context`, not an action of `02-project-memory` or `12-cook` | memory is about knowing the project, access is about reaching it; read-only probes producing a report stay on the knowledge side of the firewall (`docs/ARCHITECTURE.md`) |
| The services to check come from `ecosystem.md` edges `Agent -- mode --> Tool`, never from the recipe | a skill never links outside itself (`docs/ARCHITECTURE.md`); the edges already name each access and its mode, so no second taxonomy drifts |
| No memory => propose `/aidd-context:02-project-memory`, never run it     | the check stays read-only and never invents a service list                                                                             |
| The H4 recipe validator stays in this PR                                 | `connect-services.md` nests `#### 🔀 Version control` under the direct step `### 1)`, which the validator rejects without it          |
| Only `Agent` edges are checked; `Human` and `App` edges are ignored      | the skill can only prove the assistant's own access; a human's login or the app's runtime token are not the assistant's to probe     |
| A successful read with no expected account or target in memory is ⚠️, next step: record it in memory | success is claimed only against a known account and target; the next step turns ⚠️ into ✅ on the next run                           |
| Review #6: the recipe recommends running `/aidd-context:04-skill-generate` from the service's API | confirmed by the PR author on 2026-10-20                                                                                               |
| Delivered as commits on the PR #1026 branch; no reply posted to the review | the PR author's choice                                                                                                                  |
| `00-onboard` offers the access check as the last foundation, only right after memory is set up or wired in the session | asked by the PR author on 2026-10-20; scoping it to the setup session keeps it from blocking every later session |
