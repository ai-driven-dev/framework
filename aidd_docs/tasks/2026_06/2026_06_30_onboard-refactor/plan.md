---
objective: "Onboard enforces the memory foundation as a skippable default, then offers a project-adapted, capability-ranked action menu, on a read-once/refresh-on-change loop, without breaking suggest-never-force."
status: pending
---

# Plan: Onboard refactor

## Overview

| Field      | Value                                                                 |
| ---------- | --------------------------------------------------------------------- |
| **Goal**   | Turn onboard from one-suggestion-per-loop into a foundation-gated, project-adapted action guide that reads once and refreshes on change. |
| **Source** | `aidd_docs/tasks/2026_06/2026_06_30_onboard-refactor/brainstorm.md`   |

## Phases

| #   | Phase                                  | File                         |
| --- | -------------------------------------- | ---------------------------- |
| 1   | Lighten the read loop                  | [`phase-1.md`](./phase-1.md) |
| 2   | Foundation-first, skippable            | [`phase-2.md`](./phase-2.md) |
| 3   | Evolve journey into the capability map | [`phase-3.md`](./phase-3.md) |
| 4   | Ranked action menu in orient + act     | [`phase-4.md`](./phase-4.md) |

## Resources

| Source                                                                 | Verified                                                        |
| ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| `plugins/aidd-context/skills/00-onboard/` (SKILL + 3 actions + journey) | current structure: read → orient (one suggestion) → act → loop |
| `plugins/aidd-context/skills/04-skill-generate/references/skill-authoring.md` | the R1–R13 contract the rewrite must keep                |
| `brainstorm.md` (this folder)                                          | the refined idea and the 6 open assumptions, now resolved below |

## Decisions

| Decision                                                                                   | Why                                                                 |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Foundation is a strong, pre-selected default, never a hard gate                            | keeps the load-bearing "suggest never force" rule intact            |
| A skip of any step is recorded in the session ledger and not re-fired; the post-skip default is the next step not done/skipped | global skip with a defined owner — not scoped to the memory foundation |
| Onboard does a bounded richer read once — cheap presence signals plus a light code-quality sample and a bug-marker scan — so audit and debug can rank; still read-once, never per loop | the ranked menu needs more than presence signals to fire; read-once keeps the deeper read from being per-loop heavy |
| Evolve `references/journey.md` into the capability map; no new reference file              | journey already owns flow→capability resolution; stays DRY          |
| A step is done when a disk signal proves it OR the session ledger records it run this session; refresh re-derives disk signals + updates the ledger after a Run-it, reuse for read-only | cheap signals cannot detect off-disk completions (bootstrap→INSTALL.md, track→external, ship→merge, read-only review), so the ledger carries them — kills the re-nag |
| Foundation = memory init + sync incl. context-file blocks; empty-repo stack stays pre-foundation | the memory bank and its context blocks are one foundation       |
| The **flow-walk owns the default** (earliest unmet step, with its hedges); the **signal map only ranks the secondary tools**, never the default | one mechanism per slot — kills the flow-vs-signal default conflict the dry-run found |
| Plan status drives the build hedges: `in-progress` → Build alone; `implemented` or open-PR → Review+Ship (Review first); unprovable → Build+Review | Review is never skipped, and no premature Review at the in-progress stage |
| Need-stage offers Clarify and Track as choices, Clarify first as a soft recommendation, never a loud pre-selected default | keeps baseline's directiveness without auto-running an unprovable pick |
| Secondary tools are stage-gated and mapped from the snapshot signals: add-tests from real-test-files, audit from the code-quality sample, debug from the bug-marker scan | the richer read lets the ranked menu actually fire |
| Standing affordances render as one compact footer line, outside the ~5-line cap; the cap scopes only the default + secondary block | menu never less informative than today's, and the cap is satisfiable |
| "Presence of tests" = real test files exist, not just a configured runner | a configured runner with no test files reads as tests-absent, so add-tests fires exactly there |
| Empty repo is its own gate branch (loud default = architect a stack), cleared when `INSTALL.md` exists or architect ran this session; the memory-foundation gate applies only to a content repo with weak memory | normative diagram decides the state, and bootstrap's artifact clears the dead-end |
| Accepted trade — a code-present project still at the need stage gets no auto build-tool path, and "rough idea" gets no loud default | no cheap signal proves the build stage or the need clarity; both stay user-pickable |
