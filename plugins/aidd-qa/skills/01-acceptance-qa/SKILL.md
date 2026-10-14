---
name: 01-acceptance-qa
description: Prove reviewed browser or command journeys against acceptance criteria. Use for acceptance QA, not diff review, unit or integration tests, or application fixes.
argument-hint: acceptance criteria | reviewed candidate
---

# Acceptance QA

## Actions

Run actions in order; read only the next action's file.

| Action | Does |
| --- | --- |
| [load-scope](actions/01-load-scope.md) | select criterion-mapped scenarios |
| [prerequisites](actions/02-prerequisites.md) | verify the runner |
| [prepare-run](actions/03-prepare-run.md) | prepare isolated runs |
| [run-scenarios](actions/04-run-scenarios.md) | execute and report |

## Transversal rules

- Never patch the application or spawn agents; serialize mutations.
- Invoked by another skill or agent, return `blocked` with any pending question; never ask.
- Write every run's report to `<evidence-folder>/qa.md`, using [the report template](assets/qa-report-template.md), even when blocked.
