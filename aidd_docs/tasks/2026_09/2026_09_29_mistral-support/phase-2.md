---
status: pending
---

# Phase 2 — Rebuild the branch clean, then prove it holds

Goal: first rebuild the work on a clean lineage so every later proof binds to the branch that will be PR'd, then run the full test suite green at its head. No fix work in this phase; a failure is a finding for phase 5's triage.

## Method

- Branch from `upstream/next` as `feat/mistral-support` — format `type/short-description` and PR target `next` per `aidd_docs/memory/vcs.md`'s routing table; replay the 13 commits of `vibe/mistral-support-3eed3a` as grouped conventional commits (feat, chore, docs), authors preserved
- Keep `vibe/mistral-support-3eed3a` untouched as the archive; no force-push, no deletion
- Fidelity proof before testing: `git diff vibe/mistral-support-3eed3a vibe/mistral-support` must be empty

## Exit

- [ ] Clean branch exists, empty diff against the archive branch, evidence recorded below
- [ ] Test command(s) run, pass rates and duration recorded below
- [ ] Any failure quoted with its shortest decisive line and its file

## Evidence

(To be filled by the session that runs this phase.)
