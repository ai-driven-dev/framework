---
objective: "Every Todo issue carries a MoSCoW rank in the project, milestones are weekly themes filled from the Must items, and the documents describe exactly that."
status: pending
---

# Plan: MoSCoW backlog prioritization

Source: [`brainstorm.md`](./brainstorm.md)

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | Write the method into memory and docs | [`phase-1.md`](./phase-1.md) | none |
| 2   | Create the MoSCoW project field | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | Rank the Todo issues | [`phase-3.md`](./phase-3.md) | 2 |
| 4   | Clean existing issues and close the rolling milestone | [`phase-4.md`](./phase-4.md) | none |
| 5   | Build the weekly milestones and retire the old Priority field | [`phase-5.md`](./phase-5.md) | 3, 4 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| none | none |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | `gh project field-create` supports `SINGLE_SELECT` with `--single-select-options` (observed in `--help`); `gh issue edit` supports `--type`, `--milestone`, `--remove-milestone` (observed); `gh project edit --readme` exists and `gh issue list --json issueType` returns the type (both observed); token scopes include `project` and `admin:org`, the account is organization admin and repository admin (observed). The delete route for an organization issue field exists: a `DELETE` on a foreign id answered 404 "Issue field not found" naming the delete-issue-field endpoint (observed); an actual deletion is not tried before approval. Counts re-measured: 40 Todo, 17 untyped open issues, 73 open issues, 3 open pull requests in the rolling milestone (observed). Visibility of the new field in the Kanban and Milestones views: unverified until the field exists | 2, 4, 5 |
| regression | no workflow or script reads `Priority` (searched `.github/workflows/` and `scripts/`, no match). `close-finished-milestones.yml` only closes milestones with no open issue, so it does not conflict with the new milestones | 5 |
| architecture | none: the backlog support stays the GitHub project, issues and milestones listed in `aidd_docs/memory/backlog.md` | none |
| documentation | change `docs/MAINTAINERS.md` (field table says `Priority` is a Project field and "never both"), `GOVERNANCE.md` (one phrase), `.github/labels.yml` (comment cites a missing `Effort` field), `aidd_docs/memory/backlog.md` (priority bullet), the project README on GitHub (not in the repository) | 1, 2 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| `aidd_docs/memory/backlog.md` | it is the page being rewritten; the project is the single source of truth for order |
| `.claude/rules/01-standards/2-tracker-ids.md` | no dates or ticket IDs in the documents written |
| `aidd_docs/memory/coding-assertions.md` | pre-commit must pass, including the sentence-duplication check between documents |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| MoSCoW is a project single-select field, not an issue field or a label | agents read it with `gh project item-list` like `Status`; the issue field is invisible to `gh issue view` |
| Delete the organization `Priority` issue field last, after explicit approval | irreversible, and its 37 values are the only hint for choosing Must items |
