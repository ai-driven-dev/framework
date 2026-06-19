---
name: plan
description: Implementation plan - objective, phases, risks, and decisions, with one phase file per phase alongside it.
objective: "Ship a weekly rolling-release model on main/next with an auto-merged release PR and an automatic main->next back-merge, and align the docs."
success_condition: "git ls-remote --heads origin next succeeds, ci.yml auto-merges the release-please PR, a back-merge workflow exists, and RELEASE.md/vcs.md/GOVERNANCE.md cross-link with no duplicated release flow."
plan_status: in_progress
iteration: 0
created_at: "2026-06-19T09:12:57Z"
---

# Plan: Rolling weekly releases (main/next)

## Overview

| Field          | Value              |
| -------------- | ------------------ |
| **Goal**       | Weekly rolling releases on `main`/`next`, auto-merged release PR, auto back-merge, docs aligned with no duplication. |
| **Risk Score** | 4/10               |
| **Source**     | `aidd_docs/brainstorm/2026_06_19-rolling-weekly-releases.md` + verified repo state |

## Applicable rules

| Tool   | Rule     | Path     | Why it applies |
| ------ | -------- | -------- | -------------- |
| CLAUDE.md | No doc duplication | `framework/CLAUDE.md` | RELEASE.md, vcs.md, GOVERNANCE.md must link to a single home, not copy the flow. |
| CLAUDE.md | Responsibility placement | `docs/ARCHITECTURE.md` | Each fact lives where it belongs: flow vs mechanics vs authority. |
| memory | VCS conventions | `aidd_docs/memory/vcs.md` | Branch and commit conventions are extended, not rewritten. |
| governance | Merge authority and branch protection | `GOVERNANCE.md` | Branch-protection policy is the authority home; `next` rules belong there. |
| plan | English only | plan skill | Plan and docs are written in English. |

## Phases

| #   | Phase                       | File                                      |
| --- | --------------------------- | ----------------------------------------- |
| 1   | Branch model + CI automation | [`./1_branch-model-ci.md`](./1_branch-model-ci.md) |
| 2   | Marketplace version cleanup  | [`./2_marketplace-version-cleanup.md`](./2_marketplace-version-cleanup.md) |
| 3   | Docs alignment               | [`./3_docs-alignment.md`](./3_docs-alignment.md) |

## Risk register

| Risk     | Impact                        | Mitigation                            |
| -------- | ----------------------------- | ------------------------------------- |
| Release PR not actually auto-merging | Leak window stays open; new users get unversioned code | Verify the `gh pr merge --auto` step + repo "Allow auto-merge" + the App bypass on `main` before relying on it. |
| Back-merge missing or failing | `next` manifest/changelog drift from `main`, promotion conflicts | Dedicated back-merge workflow on release published; fail loud if it cannot fast-forward. |
| Docs land ahead of CI | Readers follow a flow `next`/auto-merge that does not exist yet | Phase 1 (branch + automation) ships before Phase 3 surfaces the docs. |
| Removing `version` from marketplace entries changes resolution | Wrong version served to users | Resolution already prefers `plugin.json`; confirm a dry release still bumps correctly. |
| Existing build jobs depend on release-please outputs | Broken artifacts on release | Do not touch `build-and-attach`, `build-per-tool`, `build-plugin`; only add an auto-merge step. |

## External resources

| Source | Verified |
| ------ | -------- |
| https://code.claude.com/docs/en/plugin-marketplaces | `version` is a cache key; resolution prefers `plugin.json`; marketplace tracks the default branch HEAD. |
| https://github.com/prometheus/prometheus/blob/main/RELEASE.md | Root `RELEASE.md` is the common (not formal) convention for a release-process doc. |

## Decisions

| Decision | Why |
| -------- | --- |
| Single watched branch: release-please stays on `main` | Simpler than dual-target; one manifest; hotfix uses the same path. |
| `next` is the integration branch, default PR target | Keeps `main` releasable-only and the marketplace clean for new users. |
| Release PR auto-merged | Shrinks the unversioned-code window on `main` to one CI run. |
| `main` -> `next` back-merge automated | Prevents manifest/changelog drift and promotion conflicts. |
| Remove `version` from marketplace.json entries | `plugin.json` is the single source; entries were stale. |

## Confidence

| Score   | ✓ Raises it | ✗ Risks it |
| ------- | ----------- | ---------- |
| 9/10  | Repo state verified (ci.yml, rulesets, marketplace.json); model decided and faits-checked against docs; phases isolated and independently verifiable. | Exact auto-merge wiring (App bypass vs required reviews on `main`) must be confirmed live; back-merge fast-forward depends on discipline. |
