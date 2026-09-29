---
status: pending
---

# Phase 5 — Challenge, triage, and conclude

Goal: run `/aidd-refine:02-challenge` over the reconstructed record and the review verdict, triage every finding (bounded fixes land in the branch; anything larger becomes a defect or a task in the backlog), then commit and open the pull request. Set `plan.md`'s frontmatter to `status: done` only when the branch is concluded.

## Exit

- [ ] `challenge.md` written, findings classified deal-breaker / suggestion / correct
- [ ] Triage recorded: fixed in branch vs. filed as defect/task
- [ ] Record wording reviewed: the task folder states facts, no process self-flagellation in the PR narrative; process lessons that outlive the task move to `aidd_docs/memory/internal/` (learn), not into the PR
- [ ] `plan.md` frontmatter set to `status: done`
- [ ] Branch committed and PR open, targeting `next` (the `feat/` prefix routes it there per `vcs.md`)

## Evidence

(To be filled by the session that runs this phase.)
