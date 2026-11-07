---
name: 02-pull-request
description: Create a draft pull or merge request, or update an existing request to reflect its current changes. Use when the user wants to open or update a pull or merge request. Not for committing, pushing, or merging a branch.
argument-hint: base | title
---

# Pull Request

For a new request, run `01 → 02 → 03`. For an existing request, run `04`.

## Actions

| #   | Action    | Step                                                        |
| --- | --------- | ----------------------------------------------------------- |
| 01  | `collect` | Resolve the base and gather the commits since it             |
| 02  | `draft`   | Write the title and body from the template                   |
| 03  | `create`  | Open the draft request, label it, and summarize it           |
| 04  | `update`  | Update an existing request within the requested scope       |

Before running an action, read its file in `actions/`, not only the table or assets.

## Transversal rules

- Follow the project's request practices in `aidd_docs/memory/vcs.md` and the repo's own request template when set, else the bundled `assets/pull_request.md`.
- Resolve the base from the branch's prefix per the project's convention (`vcs.md`), else the repo's default branch. Never assume `main`.
- Create new requests as drafts; the user promotes them.
- Apply only the triage label the branch prefix maps to, when it exists. Labels never change the base.
- Read the VCS tool from project memory, else infer it from the remote URL.
- Never commit, push, or branch here.

## Assets

- `assets/pull_request.md`: Request body template.
- `assets/branch.md`: Branch-naming convention, the fallback when project memory sets none.
