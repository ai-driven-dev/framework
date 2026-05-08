---
name: aidd-vcs:02:pull-request
description: Create a draft request from the current branch by detecting the base branch, filling the team template, and asking the user to validate before opening. The configured VCS tool is invoked transparently. Use when the user says "open a pr", "open a pull request", "create a pr", "create a merge request", "open mr", "draft a pr for this branch", or invokes `/pull-request`. Do NOT use for committing changes, pushing a branch directly, tagging releases, merging an existing request, or amending commits.
---

# Pull Request

Generates draft pull or merge requests from the current branch using the configured VCS tool. Detects the correct base branch, fills the team template with recent changes, asks for user validation, and opens the request as a draft.

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

- `assets/pull_request.md`: Request body template.
- `assets/branch.md`: Branch naming conventions.
- `assets/CONTRIBUTING.md`: Contribution guidelines template.
- `assets/README.md`: README template.

## External data

- None.
