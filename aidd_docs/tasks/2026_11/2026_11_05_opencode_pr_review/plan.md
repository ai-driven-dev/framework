---
objective: "Simplify OpenCode PR reviews using the project's AIDD CLI version or latest, the Git diff, and the GitHub PR conversation."
status: pending
---

# Plan: Simplify OpenCode PR review

Source: [PR 1150 review](https://github.com/ai-driven-dev/framework/pull/1150#pullrequestreview-5793750319) and the user's instruction to use `npx` with the project version, or `latest` when the file is missing, with access to the repository and PR conversation.

## Phases

| # | Phase | File | Depends on |
| --- | --- | --- | --- |
| 1 | Simplify the runtime and workflows | [phase-1.md](./phase-1.md) | none |
| 2 | Verify and document | [phase-2.md](./phase-2.md) | 1 |

## External sources

| URL | What it settled |
| --- | --- |
| https://docs.npmjs.com/cli/v11/commands/npx/ | Read 2026-11-06: `npx` can run a package at a specified version or tag. |
| https://cli.github.com/manual/gh_pr_view | Read 2026-11-06: `gh pr view --comments` reads the PR conversation and reviews. |
| https://docs.github.com/en/rest/pulls/comments#list-review-comments-on-a-pull-request | Read 2026-11-06: inline review comments have a separate endpoint. |
| https://docs.github.com/en/actions/reference/runners/github-hosted-runners#single-cpu-runners | Read 2026-11-06: `ubuntu-slim` cannot run Docker-in-Docker and has a 15-minute limit. |
| https://dev.opencode.ai/v2/docs/permissions/ | Read 2026-11-06: OpenCode permissions can allow `git diff` and shell access; skills and subagents have separate actions. |

## Impact

| Category | Verdict and evidence | Handled in |
| --- | --- | --- |
| Runtime | Locally verified on 2026-11-06: `npx --yes @ai-driven-dev/cli@5.6.0 setup --source remote --ai opencode --plugins aidd-dev,aidd-vcs --yes` installed both named plugins in a temporary project. `@latest` setup without a plugin list installed none. The real runner and PR publication remain unverified for this refactor. | 1, 2 |
| Regression | Preserve review of the submitted commit, skipping unchanged files, PR replies, and failure reporting. Existing orchestration is in `scripts/pr-review/review.sh`; preserve token and untrusted-code boundaries while allowing Git and GitHub access. | 1, 2 |
| Architecture | Workflows call scripts. OpenCode receives access to the repository, diff, PR discussion, and installed skills. `gh` publishes the answer in the PR. | 1 |
| Documentation | Consolidate the two image READMEs and update `proof.md` with the actual result. | 2 |

## Rules

| Rule | Why it applies |
| --- | --- |
| `AGENTS.md`: simplicity and verified behavior | Remove components rather than preserve them without a reason. |
| `aidd_docs/memory/coding-assertions.md` | Verify behavior and security guards with appropriate checks. |
| `CONTRIBUTING.md` and `Makefile` | Run `make check`; run the pre-push gate before any push. |

## Decisions

| Decision | Why |
| --- | --- |
| Use the project CLI version if its manifest exists; use `@latest` when it does not. | Explicit user instruction. The manifest's top-level `version` is a schema version; tool entries contain CLI versions. |
| Give the review access to Git and the PR conversation. | The user explicitly needs `git diff` and `gh` conversation replies. |
