---
objective: "Reconstruct the mistral-support task record retroactively, review the real shipped diff, and bring the branch to a shippable PR."
status: in-progress
---

# Plan: Mistral support, retroactive record and review

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Backfill the missing task folder for the Mistral Vibe support, review `main...HEAD` as shipped, conclude the branch |
| **Source** | Branch `vibe/mistral-support-3eed3a`, 13 commits, 239 files (+6796/-83); see [`brainstorm.md`](./brainstorm.md) |

## Session protocol

- One session per phase. Entry: read this file, run the first phase whose `status:` is not `done`.
- Exit: record evidence in the phase file, set its `status:`, update this file's frontmatter when the whole plan finishes, commit.

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Clean the branch and open the record | [`phase-1.md`](./phase-1.md) |
| 2 | Rebuild the branch clean, then prove it holds | [`phase-2.md`](./phase-2.md) |
| 3 | Reconstruct the implementation record | [`phase-3.md`](./phase-3.md) |
| 4 | Review the real diff | [`phase-4.md`](./phase-4.md) |
| 5 | Challenge, triage, and conclude | [`phase-5.md`](./phase-5.md) |

## Resources

| Source | Verified |
| --- | --- |
| `git diff --stat main...HEAD` | 239 files, +6796/-83; `cli/src` 11 files +327/-13; `cli/tests` 49 files +810/-60; the bulk is golden snapshots and flat-build output |
| Commit list `main..HEAD` | `f430866c` and `96f9175a` carry identical subjects and timestamps: one feature iterated |
| Repo convention | `aidd_docs/tasks/2026_09/2026_09_23_credit-contributors-release-notes/`, `2026_09_15_fix-829-shared-scope/` (frame, plan, phase, review, challenge, retrospective) |
| Docs landed during implementation | `2026_09_04_precommit-hooks-debug.md`, `2026_09_08_eisdir-banner-txt-debug.md`, `2026_09_08_mistral-flat-hooks-skip-debug.md`, `2026_09_08_vibe-skill-description-debug.md` (committed in phase 1) |
| Committed build output at the merge (`f4064900`) | `aidd-context/` (158 files): Mistral plugin snapshot whose `.mistral-plugin/plugin.json` manifest comes from the pre-rebrand Sep 3 mapper and whose `hooks/update_memory.js` (blob `191cde40`) predates the branch's own `plugins/aidd-context` copy (`4cb856ec`); plus `.aidd/config.json` (telemetry off). Neither merge parent had them; the head code emits `.vibe-plugin/` and `.vibe/` |
| Head diff breakdown vs `main` | After the phase 1 record commits: 245 files, +6828/-83; `aidd-context/` 5301 churn lines, `cli` 1216, `aidd_docs` 253, `scripts` 129 |
