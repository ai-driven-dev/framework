# Review: Reuse validated next CI through promotion

- **Verdict**: approve
- **Diff**: `origin/next...92941865`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_09_10
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Reuse a validated promotion snapshot

- [x] Only a same-repository `promote/next-to-main-<run-id>` PR whose exact head SHA has a successful `push` `cli / gate` on `next` may set mutation scopes to empty. — `.github/workflows/cli-ci.yml:110-145,185-202`
- [x] Missing, failed, or unreadable validation proof does not skip mutations. — `.github/workflows/cli-ci.yml:107-131,136-145,185-202`
- [x] A trusted promotion still runs coverage, smoke, build, platform, and other non-mutation checks against GitHub's PR merge ref. — `scripts/__tests__/cli-ci-gate-covers-every-job.test.js:120-140`
- [x] Ordinary pull requests retain their existing job and mutation behavior. — `.github/workflows/cli-ci.yml:136-145,185-202`

### Phase 2 — Lock the workflow contract

- [x] The contract test fails if trusted promotion detection, mutation fallback, retained checks, or gate fan-in is removed. — `scripts/__tests__/cli-ci-gate-covers-every-job.test.js:63-140`
- [x] Deployment memory accurately states when promotion skips mutations and what still runs. — `aidd_docs/memory/deployment.md:12`

### Phase 3 — Bind promotion reuse to the tested merge tree

- [x] A promotion with uncontained `main` content cannot set `mutation_scopes=[]`. — `.github/workflows/cli-ci.yml:136-145,185-202`
- [x] A promotion whose base is contained by its exact snapshot and whose `next` gate passed retains the mutation skip. — `.github/workflows/cli-ci.yml:136-145`
- [x] The contract test fails when the ancestry proof or fail-closed fallback is removed. — `scripts/__tests__/cli-ci-gate-covers-every-job.test.js:84,115-117`

### Phase 4 — Reuse the proven promotion merge on `main`

- [x] Only a two-parent merge from the numbered, same-repository promotion branch whose final tree equals the snapshot may skip mutations on `main`. — `.github/workflows/cli-ci.yml:149-175,185-202`
- [x] The matching snapshot must have a successful `push` `cli / gate` on `next`. — `.github/workflows/cli-ci.yml:110-131,170-172`
- [x] Every missing, unreadable, mismatched, or unrelated proof preserves normal mutation execution. — `.github/workflows/cli-ci.yml:107-108,149-175,185-202`
- [x] Non-mutation jobs and gate fan-in remain unchanged for all events. — `scripts/__tests__/cli-ci-gate-covers-every-job.test.js:12-27,120-140`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | --- | --- | --- | --- | --- |
| — | — | — | — | None. | — |

## Verification

| Metric | Value |
| --- | --- |
| Verified | 100% (13/13) |
| Files checked | `.github/workflows/cli-ci.yml`, `scripts/__tests__/cli-ci-gate-covers-every-job.test.js`, `aidd_docs/memory/deployment.md`, `.github/workflows/promote.yml`, `.github/rulesets/main.json`, `.github/rulesets/next.json`, `phase-1.md`, `phase-2.md`, `phase-3.md`, `phase-4.md` |
| Unchecked | none |
| Unplanned | none |
