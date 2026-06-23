---
name: 02-pull-request
description: Create a draft pull or merge request from the current branch. Use when the user ask to create a PR or invokes `/pull-request`.
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

- `@assets/pull_request.md`: Request body template.
- `@assets/branch.md`: Branch naming conventions.
- `@assets/CONTRIBUTING.md`: Contribution guidelines template.
- `@assets/README.md`: README template.

## External data

- None.
