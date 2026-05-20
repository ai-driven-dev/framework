← [aidd-framework](../../README.md)

# aidd-dev

Code transformation plugin for the AI-Driven Development framework.

> Status: stable.

First time? Install with `/plugin install aidd-dev@aidd-framework`, then run `aidd-dev:00:sdlc`.

Covers the full SDLC coding loop: orchestrator, planning, implementation, assertions, audits, code review, testing, refactoring, debugging, and the for-sure workflow. Also hosts AI agents.

## Skills

| Bracket ID | Skill | Description |
|---|---|---|
| [2.0] | [sdlc](skills/00-sdlc/README.md) | Dev SDLC orchestrator (code-shipping pipeline): spec, plan, implement, test, review, commit, PR. |
| [2.1] | [plan](skills/01-plan/README.md) | Generate technical implementation plans, define component behaviors, and extract design details from images. |
| [2.2] | [implement](skills/02-implement/README.md) | Execute an implementation plan phase by phase via the implementer agent, iterating until 100% completeness. |
| [2.3] | [assert](skills/03-assert/README.md) | Assert features work as intended - general assertions, architecture conformance, and frontend UI validation. |
| [2.4] | [audit](skills/04-audit/README.md) | Perform deep codebase analysis to identify technical debt, dead code, and improvement opportunities. |
| [2.5] | [review](skills/05-review/README.md) | Review code quality against project rules and validate feature behavior against plan specifications. |
| [2.6] | [test](skills/06-test/README.md) | Write and iterate on tests until they pass, and validate user journeys end-to-end in the browser. |
| [2.7] | [refactor](skills/07-refactor/README.md) | Optimize code for performance and fix security vulnerabilities following OWASP guidelines. |
| [2.8] | [debug](skills/08-debug/README.md) | Reproduce and fix bugs systematically using test-driven workflow, root cause analysis, and hypothesis validation. |
| [2.9] | [for-sure](skills/09-for-sure/README.md) | Iterative agent loop that tracks attempts and retries until a success condition is met. |

## Agents

| Agent | Description |
|---|---|
| planner | Orchestrator. Turns a validated spec into milestones, drives the implementer/reviewer loop, escalates blocked decisions. Never writes code, never judges code. |
| implementer | Milestone executor. Codes, tests, repairs within the milestone scope. Commits atomically per ticked checkbox. Returns completion score. |
| reviewer | Independent critic in fresh context. Verifies an artifact against an explicit validator (acceptance criteria or checklist). Returns findings, completion and quality scores. Never edits the artifact. |
