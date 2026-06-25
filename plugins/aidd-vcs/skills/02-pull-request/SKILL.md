---
name: 02-pull-request
description: Create a draft pull or merge request from the current branch, in whatever VCS tool the project uses. Use to open a PR/MR ("open a pr", `/pull-request`). Do NOT use to commit, push, or merge a branch.
---

# Pull Request

Drafts pull or merge requests from the current branch using the team's template, ready for the user to promote.

## Actions

| #   | Action          | Role                                                                | Input                                          |
| --- | --------------- | ------------------------------------------------------------------- | ---------------------------------------------- |
| 01  | `pull-request`  | Detect base, fill template, validate with user, open the draft request | base_branch (optional), template_overrides   |

## Default flow

Single action skill. The router dispatches to `pull-request` whenever a PR/MR phrase or slash command appears.

## Transversal rules

- Project first: follow `aidd_docs/memory/vcs.md` and the repo's own request-template file when they exist (body sections, base rules, labels); the rules below and the bundled templates are the fallback.
- Resolve the base branch from the head branch's prefix via the project's branch-naming convention (project memory); fall back to repo state when no prefix mapping exists. Never assume `main` or `master` (common alternatives: `next`, `develop`, `staging`).
- Always ask the user to validate the title, body, and base branch before creating the request.
- Open the request as a draft. The user promotes it manually when ready.
- After opening, apply the triage label the branch prefix maps to, when that label exists; labels triage only, they never change the resolved base.
- Never commit, never push the working branch, never create new branches inside this skill.
- Tool-agnostic: read the VCS tool from project memory; fall back to inspecting the remote URL.

## Assets

- `assets/pull_request.md`: Request body template.
- `assets/branch.md`: Branch-naming convention, the fallback when project memory sets none.
