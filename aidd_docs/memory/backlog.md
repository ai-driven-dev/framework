# Backlog

## Supports

| Support | Authority for | Role |
| --- | --- | --- |
| GitHub Issues | the work items, their type and their scope | where a change is agreed before a branch exists |
| AIDD Roadmap board (`ai-driven-dev` org project 8) | order, status, and what ships next | the single source of truth for the roadmap |
| Milestones | themes | one milestone per week, a theme; no milestone means not scheduled |
| GitHub Discussions (`ai-driven-dev/framework`) | ideas and their upvotes | where an idea is weighed before it becomes an issue |
| `aidd_docs/` task documents | the local plans, specs and reviews behind an issue | never a substitute for the issue |

## Representation

| Artifact | Support | Native representation |
| --- | --- | --- |
| Feature | GitHub Issues | issue type `Feature`, form 🌱 Quick Contribution |
| Bug | GitHub Issues | issue type `Bug`, form 🐛 Bug Report |
| Task | GitHub Issues | issue type `Task`, form 📋 Detailed Contribution |
| Theme | Milestones | one milestone |
| Rank | Roadmap board | single-select field `MoSCoW`: Must, Should, Could. Read with `gh project item-list` |
| Idea | GitHub Discussions | a discussion, ranked by 👍 |

The form stamps the type; nobody sets it by hand. Labels categorize nothing: one exists only when a bot or a human reads it. `.github/labels.yml` declares them, nothing syncs it, and drift is reconciled by hand.

## Workflow

| Support | Native status | Meaning |
| --- | --- | --- |
| Roadmap board | Ideation | weighed, not agreed |
| Roadmap board | Todo | agreed, not started |
| Roadmap board | In Progress | being worked |
| Roadmap board | In review | a pull request is open |
| Roadmap board | Done | merged |

The board is moved by hand, by a human or an agent through `gh`. No workflow advances it.

## Planning

- Rank: every accepted issue carries a `MoSCoW` value (Must, Should, Could), independent of its milestone and uncapped.
- Ranking basis: team judgment and user feedback. A public 👍 is a signal; only Core Team, Certified and Maintainer cast a counted one — mechanism in `GOVERNANCE.md`.
- Iteration: one milestone per week, a theme, due on a Friday. Filled by rank: Must first, then Should, then Could.
- Milestone: closed by `.github/workflows/close-finished-milestones.yml`, on a schedule, once all its issues are. An empty one is left open.

## Relations

- An issue's branch and pull request carry the routing: the branch prefix decides the target, per `vcs.md`.
- Hierarchy: sub-issues.
- A `aidd_docs/` task folder is grouped by its parent document (`plan.md`, then `master-plan.md`, then `spec.md`), and a sub-document's status never moves that parent.
