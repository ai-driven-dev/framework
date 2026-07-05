← [aidd-framework](../../README.md)

# aidd-dev

Code transformation plugin for the AI-Driven Development framework.

> Status: stable.

First time? Install with `/plugin install aidd-dev@aidd-framework`, then run `aidd-dev:00-sdlc`.

Covers the full SDLC coding loop: orchestrator, planning, implementation, assertions, audits, code review, testing, refactoring, debugging, and the for-sure workflow. Also hosts AI agents.

## Skills

| Bracket ID | Skill | Description |
|---|---|---|
| [2.0] | [sdlc](skills/00-sdlc/README.md) | Dev SDLC orchestrator (code-shipping pipeline): spec, plan, implement, test, review, commit, PR. |
| [2.1] | [plan](skills/01-plan/README.md) | Turn a request, ticket, or file into a phased implementation plan. Gathers context first and can wireframe a screen before planning. |
| [2.2] | [implement](skills/02-implement/README.md) | Execute an implementation plan phase by phase, iterating until it is fully complete. |
| [2.3] | [assert](skills/03-assert/README.md) | Assert features work as intended - general assertions, architecture conformance, and frontend UI validation. |
| [2.4] | [audit](skills/04-audit/README.md) | Analyze the codebase for technical debt, dead code, and improvement opportunities. |
| [2.5] | [review](skills/05-review/README.md) | Review a diff on three axes: code quality, feature behavior against the plan, and relevancy (fit to the need, rule conformance, no rot). |
| [2.6] | [test](skills/06-test/README.md) | Write and iterate on tests until they pass, and validate user journeys in the browser. |
| [2.7] | [refactor](skills/07-refactor/README.md) | Optimize code for performance and fix security vulnerabilities following OWASP guidelines. |
| [2.8] | [debug](skills/08-debug/README.md) | Reproduce and fix bugs systematically using test-driven workflow, root cause analysis, and hypothesis validation. |
| [2.9] | [for-sure](skills/09-for-sure/README.md) | Iterative agent loop that tracks attempts and retries until a success condition is met. |

## Agents

| Agent | Description |
|---|---|
| executor | Dispatched doer in its own context. Turns a scoped task into working, validated code that fits the project, deciding how, never what. Never authors a plan, never judges its own work. |
| checker | Independent critic in fresh context. Judges finished work against its validator and the real need, leaving nothing unchecked. Returns findings, scores, and a verdict. Never edits the work, never implements the fix. |
