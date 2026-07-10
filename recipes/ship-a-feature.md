<!-- Recipe contract: file is recipes/<kebab-slug>.md · Level ∈ {Beginner, Intermediate, Advanced} · Time prefixed with ~ · one idea per sentence, prefer removing over adding. -->

# Ship a feature end to end

> **Goal:** Take a feature from a rough idea to a reviewed, shipped pull request with the AIDD flow.

|                   |                                                              |
| ----------------- | ------------------------------------------------------------ |
| **Level**         | Beginner                                                     |
| **Time**          | ~varies with the feature                                     |
| **Prerequisites** | AIDD installed; project set up ([Start a project](start-a-project.md)) |

## Why

The common loop, at a glance — the exact commands to run so you never wonder what comes next.

> Prefer a guided walkthrough? `/aidd-context:00-onboard` inspects your project and routes you step by step instead of running the sequence by hand.

## Steps

1. 💡 **Clarify**: `/aidd-refine:01-brainstorm` — turn the rough idea into a precise request.
2. 📋 **Plan**: `/aidd-dev:01-plan` — draft the phased technical plan.
3. 🔧 **Implement**: `/aidd-dev:02-implement` — write the code, phase by phase.
4. 🔍 **Review**: `/aidd-dev:05-review` — review the diff before it ships.
5. 📦 **Commit**: `/aidd-vcs:01-commit` — one atomic conventional commit.
6. ✅ **Pull request**: `/aidd-vcs:02-pull-request` — open the PR.

> One command for the whole loop: `/aidd-dev:00-sdlc` runs plan → implement → review → ship.

## Verify

- A pull request is open on your branch, with the diff reviewed and tests passing.

## Related

- [Start a project](start-a-project.md) — greenfield setup before your first feature.
- `/aidd-context:00-onboard` — guidance on what to run next at any point.
