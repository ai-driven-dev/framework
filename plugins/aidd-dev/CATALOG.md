# aidd-dev catalog

Auto-generated index of skills, agents, references and assets shipped by the `aidd-dev` plugin.

> This file is automatically updated by the `scripts/summarize-markdown.js` script.

## Table of Contents

- [`.claude-plugin`](#claude-plugin)
- [`agents`](#agents)
- [`skills`](#skills)
  - [`skills/00-sdlc`](#skills00-sdlc)
  - [`skills/01-plan`](#skills01-plan)
  - [`skills/02-implement`](#skills02-implement)
  - [`skills/03-assert`](#skills03-assert)
  - [`skills/04-audit`](#skills04-audit)
  - [`skills/05-review`](#skills05-review)
  - [`skills/06-test`](#skills06-test)
  - [`skills/07-refactor`](#skills07-refactor)
  - [`skills/08-debug`](#skills08-debug)
  - [`skills/09-for-sure`](#skills09-for-sure)

---

### `.claude-plugin`

| File |
|------|
| [plugin.json](.claude-plugin/plugin.json) |

### `agents`

| File | Description |
|------|---|
| [implementer.md](agents/implementer.md) | `Milestone executor. Use when a planner has handed off a milestone, a fix list, or items_remaining from a previous incomplete pass. Codes, tests, repairs. Returns what's done, what's remaining, and a completion score. Never replans, never judges.` |
| [planner.md](agents/planner.md) | `Planning agent. Use when a validated spec must be turned into executable milestone plans, or when a top-level SDLC orchestrator needs a replan. Writes plans and decisions only. Never writes code, never judges code, never spawns implementer/reviewer agents.` |
| [reviewer.md](agents/reviewer.md) | `Independent critic in fresh context. Use when an artifact (code, spec, plan, doc) needs verification against a validator (acceptance criteria, checklist file, or any explicit ruleset). Returns reviewed items, findings, completion score and quality score. Never edits the artifact, never decides what to do next.` |

### `skills`

#### `skills/00-sdlc`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-spec.md](skills/00-sdlc/actions/01-spec.md) | - |
| `actions` | [02-plan.md](skills/00-sdlc/actions/02-plan.md) | - |
| `actions` | [03-implement.md](skills/00-sdlc/actions/03-implement.md) | - |
| `actions` | [04-review.md](skills/00-sdlc/actions/04-review.md) | - |
| `actions` | [05-ship.md](skills/00-sdlc/actions/05-ship.md) | - |
| `evals` | [scenarios.json](skills/00-sdlc/evals/scenarios.json) | - |
| `-` | [README.md](skills/00-sdlc/README.md) | - |
| `-` | [SKILL.md](skills/00-sdlc/SKILL.md) | `Pure orchestrator for the full AIDD development flow. Use when a human (or Gardener) needs to take a free-form request from idea to shipped code, end-to-end. Coordinates spec generation, planning, implementation, review, and shipping by composing other skills and agents. Supports two modes - `auto` (default, no human interaction) and `interactive` (pauses for human confirmation at key gates). Holds no business logic of its own; every step is delegated.` |

#### `skills/01-plan`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `actions` | [01-plan.md](skills/01-plan/actions/01-plan.md) | - | - |
| `actions` | [02-components-behavior.md](skills/01-plan/actions/02-components-behavior.md) | - | - |
| `actions` | [03-image-extract-details.md](skills/01-plan/actions/03-image-extract-details.md) | - | - |
| `assets` | [master-plan-template.md](skills/01-plan/assets/master-plan-template.md) | `Parent plan template orchestrating multiple child plans with validation gates` | - |
| `assets` | [plan-template.md](skills/01-plan/assets/plan-template.md) | `Living implementation plan - frozen objective, phases, and append-only execution Log. Used as input artifact AND as the autonomous-loop tracking file.` | - |
| `assets` | [tech-choice-template.md](skills/01-plan/assets/tech-choice-template.md) | `Technology selection and comparison template` | - |
| `evals` | [scenarios.json](skills/01-plan/evals/scenarios.json) | - | - |
| `-` | [README.md](skills/01-plan/README.md) | - | - |
| `references` | [mermaid-conventions.md](skills/01-plan/references/mermaid-conventions.md) | `Rules for generating valid, high-quality Mermaid diagrams. Apply when creating or reviewing any Mermaid diagram (flowchart, state, ER, sequence, gantt).` | - |
| `-` | [SKILL.md](skills/01-plan/SKILL.md) | `Generate technical implementation plans, define component behaviors, and extract design details from images.` | - |

#### `skills/02-implement`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-implement.md](skills/02-implement/actions/01-implement.md) | - |
| `evals` | [scenarios.json](skills/02-implement/evals/scenarios.json) | - |
| `-` | [README.md](skills/02-implement/README.md) | - |
| `-` | [SKILL.md](skills/02-implement/SKILL.md) | `Execute an implementation plan phase by phase via the implementer agent, iterating until 100% completeness.` |

#### `skills/03-assert`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-assert.md](skills/03-assert/actions/01-assert.md) | - |
| `actions` | [02-assert-architecture.md](skills/03-assert/actions/02-assert-architecture.md) | - |
| `actions` | [03-assert-frontend.md](skills/03-assert/actions/03-assert-frontend.md) | - |
| `assets` | [task-template.md](skills/03-assert/assets/task-template.md) | `Task tracking system to ensure all tasks are categorized and addressed` |
| `evals` | [scenarios.json](skills/03-assert/evals/scenarios.json) | - |
| `-` | [README.md](skills/03-assert/README.md) | - |
| `-` | [SKILL.md](skills/03-assert/SKILL.md) | `Assert features work as intended - general assertions, architecture conformance, and frontend UI validation.` |

#### `skills/04-audit`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `actions` | [01-audit.md](skills/04-audit/actions/01-audit.md) | - | - |
| `assets` | [audit-template.md](skills/04-audit/assets/audit-template.md) | `Codebase audit report template` | - |
| `evals` | [scenarios.json](skills/04-audit/evals/scenarios.json) | - | - |
| `-` | [README.md](skills/04-audit/README.md) | - | - |
| `-` | [SKILL.md](skills/04-audit/SKILL.md) | `Perform deep codebase analysis to identify technical debt, dead code, and improvement opportunities.` | - |

#### `skills/05-review`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `actions` | [01-review-code.md](skills/05-review/actions/01-review-code.md) | - | - |
| `actions` | [02-review-functional.md](skills/05-review/actions/02-review-functional.md) | - | - |
| `assets` | [code-review-template.md](skills/05-review/assets/code-review-template.md) | `Code review checklist and scoring template` | - |
| `assets` | [review-functional-template.md](skills/05-review/assets/review-functional-template.md) | `Functional review report template` | - |
| `assets` | [review-template.md](skills/05-review/assets/review-template.md) | `Code review checklist and scoring template` | - |
| `evals` | [scenarios.json](skills/05-review/evals/scenarios.json) | - | - |
| `-` | [README.md](skills/05-review/README.md) | - | - |
| `-` | [SKILL.md](skills/05-review/SKILL.md) | `Review code quality against project rules and validate feature behavior against plan specifications.` | - |

#### `skills/06-test`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-test.md](skills/06-test/actions/01-test.md) | - |
| `actions` | [02-test-journey.md](skills/06-test/actions/02-test-journey.md) | - |
| `evals` | [scenarios.json](skills/06-test/evals/scenarios.json) | - |
| `-` | [README.md](skills/06-test/README.md) | - |
| `-` | [SKILL.md](skills/06-test/SKILL.md) | `Write and iterate on tests until they pass, and validate user journeys end-to-end in the browser.` |

#### `skills/07-refactor`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-performance.md](skills/07-refactor/actions/01-performance.md) | - |
| `actions` | [02-security.md](skills/07-refactor/actions/02-security.md) | - |
| `evals` | [scenarios.json](skills/07-refactor/evals/scenarios.json) | - |
| `-` | [README.md](skills/07-refactor/README.md) | - |
| `-` | [SKILL.md](skills/07-refactor/SKILL.md) | `Optimize code for performance and fix security vulnerabilities following OWASP guidelines.` |

#### `skills/08-debug`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-reproduce.md](skills/08-debug/actions/01-reproduce.md) | - |
| `actions` | [02-debug.md](skills/08-debug/actions/02-debug.md) | - |
| `actions` | [03-reflect-issue.md](skills/08-debug/actions/03-reflect-issue.md) | - |
| `assets` | [task-template.md](skills/08-debug/assets/task-template.md) | `Task tracking system to ensure all tasks are categorized and addressed` |
| `evals` | [scenarios.json](skills/08-debug/evals/scenarios.json) | - |
| `-` | [README.md](skills/08-debug/README.md) | - |
| `references` | [mermaid-conventions.md](skills/08-debug/references/mermaid-conventions.md) | `Rules for generating valid, high-quality Mermaid diagrams. Apply when creating or reviewing any Mermaid diagram (flowchart, state, ER, sequence, gantt).` |
| `-` | [SKILL.md](skills/08-debug/SKILL.md) | `Reproduce and fix bugs systematically using test-driven workflow, root cause analysis, and hypothesis validation.` |

#### `skills/09-for-sure`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-init-tracking.md](skills/09-for-sure/actions/01-init-tracking.md) | - |
| `actions` | [02-auto-accept.md](skills/09-for-sure/actions/02-auto-accept.md) | - |
| `actions` | [03-autonomous-loop.md](skills/09-for-sure/actions/03-autonomous-loop.md) | - |
| `assets` | [plan-template.md](skills/09-for-sure/assets/plan-template.md) | - |
| `evals` | [scenarios.json](skills/09-for-sure/evals/scenarios.json) | - |
| `-` | [README.md](skills/09-for-sure/README.md) | - |
| `-` | [SKILL.md](skills/09-for-sure/SKILL.md) | `Iterative agent loop that tracks attempts and retries until a success condition is met. Use when the user says "for sure", "make sure", "keep trying until", "loop until done", "don't stop until", or needs guaranteed completion of a task with explicit success criteria.` |

