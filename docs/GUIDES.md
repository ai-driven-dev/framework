# Guides by goal

Pick your goal, then run its skills in order. Skip a step when its input already exists. `[x]` marks an optional step.

Skills also start from a plain request, so you can describe the goal in words. The [catalog](CATALOG.md) lists every skill.

## Start

**Join an existing project**

`/aidd-context:00-onboard`

It reads the project, then guides you through the setup, including project memory.

**Start a new project**

`/aidd-context:01-bootstrap` → `/aidd-context:02-project-memory`

Bootstrap compares stacks and writes an install plan. It creates no code.

**See what is installed, or which skill fits**

`/aidd-context:11-explore`

It maps your tools, context and code, and points to the right item. It runs nothing.

## Build

**Make a small change**

`/aidd-dev:01-plan` → `/aidd-dev:02-implement` → `/aidd-dev:03-assert` → `/aidd-dev:05-review`

Assert runs your project's checks and fixes until they pass. Review says whether the change can ship.

**Build a feature**

[`/aidd-refine:01-brainstorm`] → [`/aidd-pm:04-spec`] → `/aidd-dev:01-plan` → `/aidd-dev:02-implement` → [`/aidd-dev:06-test`] → `/aidd-dev:03-assert` → `/aidd-dev:05-review` → [`/aidd-refine:02-challenge`]

Brainstorm and spec pay off when the need is unclear or the change is risky. Challenge asks whether the finished work answers the request.

**Fix a bug**

[`/aidd-pm:09-defect`] → `/aidd-dev:08-debug` → `/aidd-dev:03-assert` → `/aidd-dev:05-review`

Debug reproduces the bug with a test, then fixes it. If the cause is unknown, it finds it first.

**Refactor or harden code**

`/aidd-dev:07-refactor` → `/aidd-dev:03-assert` → `/aidd-dev:05-review`

Refactor covers cleanup, performance, security and architecture.

**Commit and open a pull request**

`/aidd-vcs:01-commit` → `/aidd-vcs:02-pull-request` → [`/aidd-vcs:03-release-tag`]

The pull request skill sets the target branch from your project's rules.

**Run several independent tasks at once**

`/aidd-dev:10-batch`

It splits a request into tasks and runs them in parallel.

**Keep going until a command passes**

`/aidd-dev:09-for-sure`

It retries until your success command passes.

## Understand and decide

**Investigate a technical unknown**

`/aidd-pm:05-spike` → [`/aidd-pm:10-task`] or [`/aidd-pm:04-spec`]

A spike ends with an outcome and a follow-up. Stop there if nothing more is needed.

**Sharpen a vague idea**

`/aidd-refine:01-brainstorm`

It asks questions until the idea is clear.

**Find gaps in a written document**

`/aidd-refine:03-shadow-areas`

Works on an idea, stories, a PRD or a spec.

**Check the facts in a text**

`/aidd-refine:04-fact-check`

It checks claims against sources and cites them.

**Audit a whole codebase**

`/aidd-dev:04-audit`

Read-only. It ranks findings and fixes nothing.

## Plan the product

**Frame an opportunity**

`/aidd-pm:06-product-brief` → `/aidd-pm:07-epic` → `/aidd-pm:02-user-stories`

Each one stands alone. Stop at the level you need.

**Write requirements**

`/aidd-pm:03-prd` or `/aidd-pm:04-spec`

A PRD describes the product need. A spec is the contract for one feature.

**Refine an Epic or a Story**

`/aidd-pm:08-three-amigos`

It looks at one from a product, delivery or quality angle.

**Read a ticket**

`/aidd-pm:01-ticket-info`

**Run the backlog**

`/aidd-orchestrator:02-backlog`

Intake, triage, refinement, ordering and health checks.

## Let the framework drive

**Deliver a request end to end**

`/aidd-orchestrator:01-sdlc`

It frames the request, plans, builds, reviews, challenges the outcome and opens a draft pull request. Do not replay its steps by hand. Start the request with `interactive` to approve the contract, the plan and the outcome.

**Turn issues into pull requests without you**

`/aidd-orchestrator:00-async-dev`

It sets up the automation, runs a ready issue, or answers review comments.

## Keep what you learn

**Record a decision or a lesson**

`/aidd-context:10-learn`

It files the lesson in memory, a decision record, a rule or a skill.

**Create a skill, rule, agent, command or hook**

`/aidd-context:04-skill-generate` · `/aidd-context:05-rule-generate` · `/aidd-context:06-agent-generate` · `/aidd-context:07-command-generate` · `/aidd-context:08-hook-generate`

Not sure which kind? `/aidd-context:03-context-generate` picks the generator for you.

**Follow a how-to sheet**

`/aidd-context:12-cook`

Bundled recipes: [MCP installation](../plugins/aidd-context/skills/12-cook/assets/recipes/mcp-installation.md), [token optimization](../plugins/aidd-context/skills/12-cook/assets/recipes/token-optimization.md), [the AIDDy mascot in the ChatGPT desktop app](../plugins/aidd-context/skills/12-cook/assets/recipes/install-aiddy-in-codex.md).

**Improve how you work with the AI**

`/aidd-refine:05-improve`

It reads a conversation, measures what it cost, and recommends small changes.

## Prove it works

**Check a change in a browser, with video evidence**

`/aidd-qa:01-acceptance-qa`

It records short videos against the acceptance criteria. It does not replace unit tests.

**See what a task cost in tokens**

`/aidd-telemetry:00-init` → `/aidd-telemetry:01-usage`

Opt-in and local. See the [FAQ](FAQ.md#measurement).
