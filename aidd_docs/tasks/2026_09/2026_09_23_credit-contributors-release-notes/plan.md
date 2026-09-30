---
objective: "Every GitHub release credits each changelog line's commit author by @handle, and main accepts only merge commits so a promote keeps every commit and its author."
status: pending
---

# Plan: Credit contributors in release notes

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Post-process each GitHub release to append the commit author's `@handle` per line, and restrict `main` to merge commits |
| **Source** | [#911](https://github.com/ai-driven-dev/framework/issues/911), [`brainstorm.md`](./brainstorm.md) |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Credit commit authors in GitHub releases | [`phase-1.md`](./phase-1.md) |
| 2 | Restrict main to merge commits | [`phase-2.md`](./phase-2.md) |

## Resources

| Source | Verified |
| --- | --- |
| Sandbox repo, release-please 17.11.2 CLI, `include-commit-authors: true` | the generated notes carried no author at all |
| `release-please` 17.11.2 `build/src/commit.js` `parseConventionalCommits` | the parsed commit drops `author`, so `default.js` never sees one. Upstream [#2761](https://github.com/googleapis/release-please/issues/2761), fix [#2892](https://github.com/googleapis/release-please/pull/2892) open, 17.11.2 is the latest release |
| `release-please` `build/src/changelog-notes/github.js` | `changelog-type: github` ignores commits and reads the whole tag range, which is wrong for component releases |
| Prototype run on the sandbox's releases, then a second run | every line gained `(@login)`; the second run changed nothing |
| Prototype dry run over `v5.10.0`'s real notes, read-only | all 44 lines credited: 33 `@blafourcade`, 7 `@dependabot[bot]`, 1 `@alexsoyes`, including lines ending in `, closes #…` |
| `gh pr list --base next` (60 PRs) and `gh api commits/<sha>` | a squash commit's author is the PR author (55/55 humans), even when someone else merges |
| `back-merge.yml` `on:` | triggers on `release: published` only. Editing a release fires `edited`, so crediting does not re-run the back-merge |
| Sandbox, ruleset `allowed_merge_methods: ["merge"]` | squash and rebase refused, merge accepted |
| Sandbox, bypass actor in `pull_request` mode (the live mode for `aidd-bot` and `admin`) | squash still refused, even with `--admin`. Only `always` mode allowed it |
| Sandbox, release PR under that ruleset | `--squash --admin` refused; `--merge --admin` merged and release-please tagged all three releases on the merge commit |
| Sandbox, back-merge `--no-ff` then a second cycle | no conflict; the next release carried only the new line, only for the touched component |
| Sandbox, squashed promote with the ruleset disabled | release-please logged "No user facing commits found": the week's entries vanished silently |
| `.../rulesets/12902947` | live `main protection` carries `allowed_merge_methods: [merge, squash, rebase]`, absent from `.github/rulesets/main.json`; nothing syncs the two |
| PR #135, commit `1919c7cd` | this repository already released from a merge-commit release PR (`v4.1.0`) |
| `@commitlint/is-ignored` `lib/defaults.js` | `Merge pull request …` subjects are ignored, so a merge commit on `main`'s tip passes commitlint |

## Decisions

| Decision | Why |
| --- | --- |
| Post-process the GitHub releases, not the native option | the native option is a no-op until upstream #2892 ships. The step carries a comment linking #2761 and #2892, and #911 records the follow-up: remove it once a fixed release-please is pinned |
| Resolve the author from each line's commit SHA, not its `#N` | the SHA is the commit release-please credited; a line can also carry `closes #N`. Matches the committer semantics agreed in brainstorm |
| No login resolves: append the author's name without `@` | same fallback as the native option |
| A line already ending in `(@…)` or a credited name is left alone | re-running the job never duplicates |
| Only the GitHub releases carry handles | `CHANGELOG.md` and the release PR body are written before the step runs. Accepted |
| `main` allows only merge commits | a ruleset cannot target a head branch. In `pull_request` bypass mode nobody, admins included, can squash or rebase a promote |
| The release PR merges with `--merge --admin` | `--squash --admin` is refused under the ruleset. `--admin` stays for approvals |
| Rollout order: the `--merge` release merge ships and proves itself before the live ruleset changes | applied first, the ruleset would block the next release |
| No post-merge net | the ruleset already blocks every actor in `pull_request` mode; only turning a bypass to `always` or disabling the ruleset reopens the gap |
| A `hotfix/*` lands as a merge commit | the one human flow that changes. Its subject is ignored by commitlint, and release-please reads its conventional commits |

Tradeoffs the user accepts:

- A `@login` in nine release bodies may notify each contributor every cycle. Not verified.
- `(@dependabot[bot])` appears on dependency lines.
