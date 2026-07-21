# aidd-dev

Code transformation plugin for the AI-Driven Development framework.

Covers the full SDLC coding loop: orchestrator, planning, assertions, audits, code review, testing, refactoring, debugging, and the for-sure workflow. Also hosts AI agents.

## Skills

| Bracket ID | Skill | Description |
|---|---|---|
| [2.0] | sdlc | SDLC orchestrator - plan, implement, test, review, commit, PR. |
| [2.1] | plan | Generate technical implementation plans, define component behaviors, and extract design details from images. |
| [2.2] | assert | Assert features work as intended - general assertions, architecture conformance, and frontend UI validation. |
| [2.3] | audit | Perform deep codebase analysis to identify technical debt, dead code, and improvement opportunities. |
| [2.4] | review | Review code quality against project rules and validate feature behavior against plan specifications. |
| [2.5] | test | Write and iterate on tests until they pass, and validate user journeys end-to-end in the browser. |
| [2.6] | refactor | Optimize code for performance and fix security vulnerabilities following OWASP guidelines. |
| [2.7] | debug | Reproduce and fix bugs systematically using test-driven workflow, root cause analysis, and hypothesis validation. |
| [2.8] | for-sure | Iterative agent loop that tracks attempts and retries until a success condition is met. |

## Agents

| Agent | Description |
|---|---|
| planner | Orchestrator. Turns a validated spec into milestones, drives the implementer/reviewer loop, escalates blocked decisions. Never writes code, never judges code. |
| implementer | Milestone executor. Codes, tests, repairs within the milestone scope. Commits atomically per ticked checkbox. Returns completion score. |
| reviewer | Independent critic in fresh context. Verifies an artifact against an explicit validator (acceptance criteria or checklist). Returns findings, completion and quality scores. Never edits the artifact. |
