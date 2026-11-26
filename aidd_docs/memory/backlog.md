# Backlog

## Supports

| Support | Authority for | Role |
| --- | --- | --- |
| GitHub Issues | the work items, their type and their scope | where a change is agreed before a branch exists |
| AIDD Roadmap board (`ai-driven-dev` org project 8) | order, status, and what ships next | the roadmap's single source of truth |
| Milestones | themes | one milestone per theme; no milestone means backlog |
| GitHub Discussions (`ai-driven-dev/framework`) | ideas and their upvotes | where an idea is weighed before it becomes an issue |
| `aidd_docs/` task documents | the local plans, specs and reviews behind an issue | never replaces the issue |

## Representation

| Artifact | Support | Native representation |
| --- | --- | --- |
| Feature | GitHub Issues | issue type `Feature`, form 🌱 Quick Contribution |
| Bug | GitHub Issues | issue type `Bug`, form 🐛 Bug Report |
| Task | GitHub Issues | issue type `Task`, form 📋 Detailed Contribution |
| Theme | Milestones | one milestone |
| Idea | GitHub Discussions | a discussion, ranked by 👍 |

- The issue form stamps the type; nobody sets it by hand.
- A label exists only when a bot or a human reads it; labels categorize nothing.
- `.github/labels.yml` declares the labels; nothing syncs it, so drift is reconciled by hand.

## Workflow

| Board status | Meaning |
| --- | --- |
| Ideation | weighed, not agreed |
| Todo | agreed, not started |
| In Progress | being worked |
| In review | a pull request is open |
| Done | merged |

- The board moves by hand, by a human or an agent through `gh`; no workflow advances it.

## Planning

- Priority: a public 👍 is a signal, not a vote; only Core Team, Certified and Maintainer votes count (`GOVERNANCE.md`).
- Iteration: weekly.
- Milestone: `.github/workflows/close-finished-milestones.yml` closes it once all its issues are; an empty one stays open.

## Relations

- The branch prefix decides a pull request's target, per `vcs.md`.
- An `aidd_docs/` task folder is grouped by its parent document: `plan.md`, then `master-plan.md`, then `spec.md`.
- A sub-document's status never moves its parent.
