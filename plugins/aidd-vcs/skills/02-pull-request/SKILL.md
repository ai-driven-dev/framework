---
name: 02-pull-request
description: Create a pull or merge request and establish ownership of its check and review follow-up. Use when the user wants to open a pull or merge request. Not for committing, pushing, or merging a branch.
argument-hint: base | title
---

# Pull Request

Collect the change, draft the request, create it, establish follow-up. `01 → 02 → 03 → 04`.

## Actions

| #   | Action    | Step                                                        |
| --- | --------- | ----------------------------------------------------------- |
| 01  | `collect` | Resolve the base and gather the commits since it             |
| 02  | `draft`   | Write the title and body from the template                   |
| 03  | `create`  | Open the request, link it, label it                          |
| 04  | `follow-up` | Reconcile feedback and establish its persistent owner    |

Before running an action, read its file in `actions/`, not only the table or assets.

## Transversal rules

- Read the repository instructions and the project's request practices in `aidd_docs/memory/vcs.md`, including any local creation and review-handling skills they require. Apply those contracts and the repo's request template when set, else the bundled `assets/pull_request.md`.
- Resolve the base from the branch's prefix per the project's convention (`vcs.md`), else the repo's default branch. Never assume `main`.
- Default to draft unless the user or repository contract requires Ready for review. Do not promote intentionally unfinished work.
- Apply only the triage label the branch prefix maps to, when it exists. Labels never change the base.
- Read the VCS tool from project memory, else infer it from the remote URL.
- Creation never commits, pushes or branches. Follow-up routes authorized corrections and publication to the responsible implementation and VCS capabilities; it does not grant new authorization.

## Assets

- `assets/pull_request.md`: Request body template.
- `assets/branch.md`: Branch-naming convention, the fallback when project memory sets none.
