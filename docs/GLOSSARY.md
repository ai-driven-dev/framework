# Glossary

Definitions for the terms the framework uses without re-explaining each time. One paragraph per term, ordered for reading top to bottom.

## Plugin

A `plugins/<name>/` directory installable from this marketplace into Claude Code. Each plugin owns one domain (context, dev, vcs, pm, orchestrator, refine), ships its own README, CATALOG, skills, and optionally agents, hooks, and MCP config. Plugins version independently via `release-please`.

## Marketplace

The Git repository that publishes plugins. When you run `/plugin marketplace add <owner>/<repo>` Claude Code reads `.claude-plugin/marketplace.json` and offers the listed plugins for install. This repo (`aidd-framework`) is one such marketplace and versions independently of the plugins it ships.

## Skill

A self-contained workflow under `plugins/<plugin>/skills/<NN-name>/`. Triggered by a user phrase, a slash command, or an explicit `Use skill <id>` invocation. A skill owns a `SKILL.md` router, one or more atomic actions, optional `assets/` and `evals/`. Skill ids look like `<plugin>:<NN>:<slug>` (for example `aidd-context:00:onboard`).

## Router-based skill

The shape every skill in this framework follows. `SKILL.md` is a pure router: it lists triggers, declares `## Available actions`, and dispatches to one of them. It carries no business logic. The logic lives in the action files. This split keeps triggering predictable and keeps each step independently testable.

## Action

A single atomic step inside a skill, stored at `plugins/<plugin>/skills/<NN-name>/actions/NN-name.md`. Each action file contains only `## Inputs`, `## Outputs`, `## Process`, `## Test`, and optionally `## Depends on`. Tests must be observable: a command to run, an artifact to check, or a side effect to verify.

## Agent

A specialized AI persona under `plugins/<plugin>/agents/<name>.md`. Agents are scoped (for example `planner`, `implementer`, `reviewer`) and called from skills when a step needs a dedicated role rather than the main thread. Currently agents ship only in `aidd-dev`.

## Rule

A coding standard the AI loads automatically on relevant files. Rules live under each tool's rules directory (Claude Code uses `.claude/rules/`) and can be scoped via `paths:` glob frontmatter. Rules without `paths` apply to all files. Rules describe how to write code; skills describe what to do.

## Hook

A program declared in `plugins/<plugin>/hooks/hooks.json` that Claude Code runs at lifecycle events (pre-commit, post-tool, etc.). Hooks are how the framework triggers side effects deterministically (label routing, audit writes) rather than asking the model to remember.

## SDLC capability

A pluggable provider of one or more SDLC steps (spec, plan, implement, test, review, ship). The orchestrator does not hardcode `aidd-dev`; it asks whichever capability is loaded at runtime. Today `aidd-dev:00:sdlc` is the reference implementation. Other capabilities can plug into the same contract.

## Use case

A named orchestration scenario inside `aidd-orchestrator`. The plugin holds several use cases side by side, each with its own skills. `async-dev` (label an issue, get a PR) is the only stable use case today; `agentic-orchestration` and `flow-orchestration` are on the roadmap.

## Bracket ID

The short identifier in each plugin's Skills table, for example `[2.1]` for `aidd-dev:01:plan`. The first digit is the plugin ordinal; the second is the skill position inside the plugin. Bracket IDs are stable references the audit and catalog files use to point at a skill without spelling out the full id.

## Lifecycle label

A GitHub label the `async-dev` use case uses to track an issue through the pipeline. The canonical set is `to-implement`, `claude/working`, `claude/awaiting-review`, `to-review`. Labels move only at well-defined transitions, which keeps the pipeline auditable from the issues tab alone.

## `claude/working` lock

The label the `async-dev` skill adds to an issue at the start of a run and removes when the PR opens. It exists to prevent two concurrent agents from picking up the same issue. It is set after dependency resolution and before any code is written.

## Run id

A timestamp-prefixed string that uniquely identifies one async-dev run, for example `2026-05-07T10-12-31Z-i42`. It is the filename component of the per-run audit artifact and the value the pipeline writes back as a PR comment.

## Audit JSON

A structured per-run record written to `aidd_docs/async-runs/<YYYY_MM>/<run-id>.json` by the orchestrator. It captures the issue snapshot, the decisions taken at each step, the outcome, and the resulting PR url. Audit JSON is the durable source of truth a human can replay weeks later to understand what an autonomous run did.

## See also

- [`../README.md`](../README.md) for the marketplace overview, plugin catalog, and install flow.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) for the composition model and skill router pattern.
- [`CATALOG.md`](CATALOG.md) for the full skills index.
