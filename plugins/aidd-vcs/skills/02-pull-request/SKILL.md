---
name: aidd-vcs:02:pull-request
description: Create a draft pull or merge request from the current branch. Use when the user says "open a pr", "open a pull request", "create a pr", "create a merge request", "open mr", "draft a pr for this branch", or invokes `/pull-request`. Do NOT use for committing changes, pushing a branch directly, tagging releases, merging an existing request, or amending commits.
---

# Pull Request

Drafts pull or merge requests from the current branch using the team's template, ready for the user to promote.

## Available actions

| #   | Action          | Role                                                                | Input                                          |
| --- | --------------- | ------------------------------------------------------------------- | ---------------------------------------------- |
| 01  | `pull-request`  | Detect base, fill template, validate with user, open the draft request | base_branch (optional), template_overrides   |

## Default flow

Single action skill. The router dispatches to `pull-request` whenever a PR/MR phrase or slash command appears.

## Transversal rules

- Detect the base branch from repo state. Do NOT assume `main` or `master` (common alternatives: `develop`, `staging`).
- Always ask the user to validate the title, body, and base branch before creating the request.
- Open the request as a draft. The user promotes it manually when ready.
- Never commit, never push the working branch, never create new branches inside this skill.
- Tool-agnostic: read the VCS tool from project memory; fall back to inspecting the remote URL.

## References

- None.

## Assets

- `${CLAUDE_PLUGIN_ROOT}/skills/02-pull-request/assets/pull_request.md`: Request body template.
- `${CLAUDE_PLUGIN_ROOT}/skills/02-pull-request/assets/branch.md`: Branch naming conventions.
- `${CLAUDE_PLUGIN_ROOT}/skills/02-pull-request/assets/CONTRIBUTING.md`: Contribution guidelines template.
- `${CLAUDE_PLUGIN_ROOT}/skills/02-pull-request/assets/README.md`: README template.

## External data

- None.
