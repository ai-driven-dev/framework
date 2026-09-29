---
status: pending
---

# Phase 4 — Review the real diff

Goal: run `/aidd-dev:05-review` on `main...HEAD` as actually shipped, and land the verdict in `review.md`. The reviewable surface is small (11 files in `cli/src`, 49 in `cli/tests`); the golden snapshots and flat-build output are audited for intent, not read line by line. If the diff does not fit one session's context, split by zone (`cli/src` + `cli/tests`, then snapshots + scripts + plugins) into two passes of this phase.

## Exit

- [ ] `review.md` written with verdict, phases, findings, file:line evidence
- [ ] Findings classified critical / warning / minor

## Evidence

(To be filled by the session that runs this phase.)
