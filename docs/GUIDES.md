# Guides by goal

Start from what you want to do, not from a skill name. Each path below is a typical order, not a fixed pipeline. Skip a step when its input already exists, and stop when the goal is met.

How to read a path:

- `→` means "then". Steps in `[brackets]` are optional.
- Each skill is invoked as `/plugin:skill`. The [catalog](CATALOG.md) lists every skill and what it does.
- Prefer the shortest path that works. A well-specified change does not need a spec, a challenge and a Task.

## Start

| Goal | Typical path | Notes |
| --- | --- | --- |
| Join an existing project | `/aidd-context:00-onboard` → `/aidd-context:02-project-memory` → [`/aidd-context:11-explore`] | Onboarding reads the project and may run project memory for you. Explore maps what is installed and does not prescribe a next step. |
| Start a new project | `/aidd-context:01-bootstrap` → `/aidd-context:02-project-memory` | Bootstrap compares stacks and writes an install plan. It does not create code. |
| Not sure what to do next | `/aidd-context:00-onboard` | It suggests the next step from the state of the project. |

## Build

| Goal | Typical path | Notes |
| --- | --- | --- |
| Make a small, clear change | [`/aidd-pm:10-task`] → `/aidd-dev:01-plan` → `/aidd-dev:02-implement` → [`/aidd-dev:06-test`] → `/aidd-dev:03-assert` → `/aidd-dev:05-review` | Skip the Task and the new tests when the change is trivial or already specified. |
| Build a feature | [`/aidd-pm:04-spec` or `/aidd-pm:02-user-stories`] → `/aidd-dev:01-plan` → [`/aidd-refine:02-challenge`] → `/aidd-dev:02-implement` → `/aidd-dev:06-test` → `/aidd-dev:03-assert` → `/aidd-dev:05-review` → `/aidd-vcs:01-commit` → `/aidd-vcs:02-pull-request` | The spec and the challenge are worth their time when the need is unclear or the change is risky. |
| Fix a bug | [`/aidd-pm:09-defect`] → `/aidd-dev:08-debug` → [`/aidd-dev:06-test`] → `/aidd-dev:03-assert` → `/aidd-dev:05-review` | Skip the Defect when an issue already describes the bug. Debug can write the reproducing test itself. |
| Refactor or harden code | `/aidd-dev:07-refactor` → `/aidd-dev:03-assert` → `/aidd-dev:05-review` | Refactor works on cleanup, performance, security or architecture. |
| Ship it | `/aidd-vcs:01-commit` → `/aidd-vcs:02-pull-request` → [`/aidd-vcs:03-release-tag`] | The pull request skill sets the target branch from the project's rules. |

## Understand and decide

| Goal | Typical path | Notes |
| --- | --- | --- |
| Investigate a technical unknown | `/aidd-pm:05-spike` → [`/aidd-refine:02-challenge`] → `/aidd-pm:10-task` or `/aidd-pm:04-spec` | A spike ends with an outcome and a follow-up. Stop there if the outcome does not call for more work. |
| Sharpen a vague idea | `/aidd-refine:01-brainstorm` | Asks questions until the idea is clear. You choose the next step, for example a product brief. |
| Check a written artifact for gaps | `/aidd-refine:03-shadow-areas` | Works on an idea, stories, a PRD or a spec. |
| Review a change | `/aidd-dev:05-review` | Says whether the change is ready to ship and lists the fixes. |
| Audit a whole codebase | `/aidd-dev:04-audit` | Read-only. It ranks findings and fixes nothing. |

## Plan the product

| Goal | Typical path | Notes |
| --- | --- | --- |
| Frame an opportunity | `/aidd-pm:06-product-brief` → `/aidd-pm:07-epic` → `/aidd-pm:02-user-stories` | Each artifact stands alone. Stop at the level you need. |
| Refine with three perspectives | `/aidd-pm:08-three-amigos` | For an Epic or a Story: evaluates from one perspective, or reconciles three reports you provide. |
| Run the backlog | `/aidd-orchestrator:02-backlog` | Intake, triage, refinement, ordering and health checks. |

## Let the framework drive

| Goal | Run | Notes |
| --- | --- | --- |
| Deliver a request end to end | `/aidd-orchestrator:01-sdlc` | It frames, plans, builds, reviews, challenges the outcome and opens a draft pull request. Do not replay its steps by hand. Say `interactive` to approve its checkpoints. |
| Run issues to pull requests without you | `/aidd-orchestrator:00-async-dev` | Sets up the automation, runs a ready issue, or answers review comments. |

## Keep what you learn

| Goal | Run | Notes |
| --- | --- | --- |
| Record a decision or a lesson | `/aidd-context:10-learn` | Routes it to memory, a decision record, a rule or a skill. |
| Add a rule, skill, agent, command or hook | `/aidd-context:03-context-generate` | Routes your request to the right generator when you have not named the kind. Name the kind and its own generator runs directly. |
| Follow a how-to sheet | `/aidd-context:12-cook` | Bundled recipes: [MCP installation](../plugins/aidd-context/skills/12-cook/assets/recipes/mcp-installation.md), [token optimization](../plugins/aidd-context/skills/12-cook/assets/recipes/token-optimization.md), [install the AIDDy mascot in the ChatGPT desktop app](../plugins/aidd-context/skills/12-cook/assets/recipes/install-aiddy-in-codex.md). |

## Prove it works

| Goal | Run | Notes |
| --- | --- | --- |
| Check a change against its acceptance criteria in a browser | `/aidd-qa:01-acceptance-qa` | Records short videos as evidence. Not a replacement for unit tests. |
| See what a task cost in tokens | `/aidd-telemetry:00-init`, then `/aidd-telemetry:01-usage` | Opt-in and local. See the [FAQ](FAQ.md#measurement). |
