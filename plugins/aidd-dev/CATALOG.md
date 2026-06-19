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
  - [`skills/10-todo`](#skills10-todo)

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
| `-` | [README.md](skills/00-sdlc/README.md) | - |
| `-` | [SKILL.md](skills/00-sdlc/SKILL.md) | `Pure orchestrator for the full AIDD development flow. Use when a human (or Gardener) needs to take a free-form request from idea to shipped code, end-to-end. Coordinates spec generation, planning, implementation, review, and shipping by composing other skills and agents. Supports two modes - `auto` (default, no human interaction) and `interactive` (pauses for human confirmation at key gates). Holds no business logic of its own; every step is delegated.` |

#### `skills/01-plan`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-gather.md](skills/01-plan/actions/01-gather.md) | - |
| `actions` | [02-wireframe.md](skills/01-plan/actions/02-wireframe.md) | - |
| `actions` | [03-plan.md](skills/01-plan/actions/03-plan.md) | - |
| `assets` | [phase-template.md](skills/01-plan/assets/phase-template.md) | `One phase of a plan - its projection slice, user journey, tasks, and acceptance criteria. The implementer loop tracks it via status and iteration.` |
| `assets` | [plan-template.md](skills/01-plan/assets/plan-template.md) | `A feature's implementation plan - rules, phases, risks, decisions. One phase file sits next to it per phase.` |
| `-` | [README.md](skills/01-plan/README.md) | - |
| `references` | [mermaid-conventions.md](skills/01-plan/references/mermaid-conventions.md) | `Rules for generating valid, high-quality Mermaid diagrams. Apply when creating or reviewing any Mermaid diagram (flowchart, state, ER, sequence, gantt).` |
| `-` | [SKILL.md](skills/01-plan/SKILL.md) | `Turn a request, ticket, or file into a phased implementation plan, gathering the source first and optionally wireframing a screen before planning. Use when the user wants to plan a feature, turn a ticket or requirements into a phased plan, or wireframe a screen before building. Do NOT use to write code (use 02-implement), review a diff (use 05-review), or audit code (use 04-audit).` |

#### `skills/02-implement`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-implement.md](skills/02-implement/actions/01-implement.md) | - |
| `-` | [README.md](skills/02-implement/README.md) | - |
| `-` | [SKILL.md](skills/02-implement/SKILL.md) | `Execute an implementation plan phase by phase via the implementer agent, iterating until 100% completeness.` |

#### `skills/03-assert`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-assert.md](skills/03-assert/actions/01-assert.md) | - |
| `actions` | [02-assert-architecture.md](skills/03-assert/actions/02-assert-architecture.md) | - |
| `actions` | [03-assert-frontend.md](skills/03-assert/actions/03-assert-frontend.md) | - |
| `assets` | [task-template.md](skills/03-assert/assets/task-template.md) | `Task tracking system to ensure all tasks are categorized and addressed` |
| `-` | [README.md](skills/03-assert/README.md) | - |
| `-` | [SKILL.md](skills/03-assert/SKILL.md) | `Assert features work as intended - general assertions, architecture conformance, and frontend UI validation.` |

#### `skills/04-audit`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `actions` | [01-code-quality.md](skills/04-audit/actions/01-code-quality.md) | - | - |
| `actions` | [02-architecture.md](skills/04-audit/actions/02-architecture.md) | - | - |
| `actions` | [03-security.md](skills/04-audit/actions/03-security.md) | - | - |
| `actions` | [04-dependencies.md](skills/04-audit/actions/04-dependencies.md) | - | - |
| `actions` | [05-performance.md](skills/04-audit/actions/05-performance.md) | - | - |
| `actions` | [06-tests.md](skills/04-audit/actions/06-tests.md) | - | - |
| `actions` | [07-ui.md](skills/04-audit/actions/07-ui.md) | - | - |
| `assets` | [audit-template.md](skills/04-audit/assets/audit-template.md) | `Codebase audit report template` | - |
| `-` | [README.md](skills/04-audit/README.md) | - | - |
| `-` | [SKILL.md](skills/04-audit/SKILL.md) | `Read-only codebase audit across quality pillars (code-quality, architecture, security, dependencies, performance, tests, ui). Diagnoses and reports findings; never edits code. Use when the user wants to assess, audit, or health-check a codebase or one dimension of it, then hands off to the act-skills (refactor, test, impeccable) to fix. Do NOT use for fixing the findings (hand off to refactor/test/impeccable), per-PR code review (use 05-review), or validating that a feature works (use 03-assert).` | - |

#### `skills/05-review`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `actions` | [01-review-code.md](skills/05-review/actions/01-review-code.md) | - | - |
| `actions` | [02-review-functional.md](skills/05-review/actions/02-review-functional.md) | - | - |
| `assets` | [review-code-template.md](skills/05-review/assets/review-code-template.md) | `Code review report template for a diff` | - |
| `assets` | [review-functional-template.md](skills/05-review/assets/review-functional-template.md) | `Functional review report template for a diff against a plan` | - |
| `-` | [README.md](skills/05-review/README.md) | - | - |
| `-` | [SKILL.md](skills/05-review/SKILL.md) | `Read-only review of a diff (a PR or working changes) - code quality against project rules, and feature behavior against the plan's acceptance criteria. Surfaces findings with a verdict; never patches. Use to review changes in progress. Do NOT use for a whole-codebase health check (use 04-audit), fixing the findings (hand off to 07-refactor / 02-implement / 08-debug), or validating a feature runs (use 03-assert).` | - |

#### `skills/06-test`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-test.md](skills/06-test/actions/01-test.md) | - |
| `actions` | [02-test-journey.md](skills/06-test/actions/02-test-journey.md) | - |
| `-` | [README.md](skills/06-test/README.md) | - |
| `-` | [SKILL.md](skills/06-test/SKILL.md) | `Write and iterate on tests until they pass, and validate user journeys end-to-end in the browser.` |

#### `skills/07-refactor`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-performance.md](skills/07-refactor/actions/01-performance.md) | - |
| `actions` | [02-security.md](skills/07-refactor/actions/02-security.md) | - |
| `actions` | [03-cleanup.md](skills/07-refactor/actions/03-cleanup.md) | - |
| `actions` | [04-architecture.md](skills/07-refactor/actions/04-architecture.md) | - |
| `-` | [README.md](skills/07-refactor/README.md) | - |
| `-` | [SKILL.md](skills/07-refactor/SKILL.md) | `Improve code without breaking behavior across four axes - cleanup (clean-code + tech debt), performance, security, architecture. Scans and fixes, or fixes the findings of an audit report pushed in by the caller. Use when the user wants to refactor, clean up, optimize, harden, or restructure code. Do NOT use for read-only diagnosis (use 04-audit), adding tests (use 06-test), or UI redesign (use the impeccable skill).` |

#### `skills/08-debug`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-reproduce.md](skills/08-debug/actions/01-reproduce.md) | - |
| `actions` | [02-debug.md](skills/08-debug/actions/02-debug.md) | - |
| `actions` | [03-reflect-issue.md](skills/08-debug/actions/03-reflect-issue.md) | - |
| `assets` | [task-template.md](skills/08-debug/assets/task-template.md) | `Task tracking system to ensure all tasks are categorized and addressed` |
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
| `-` | [README.md](skills/09-for-sure/README.md) | - |
| `-` | [SKILL.md](skills/09-for-sure/SKILL.md) | `Iterative agent loop that tracks attempts and retries until a success condition is met. Use when the user says "for sure", "make sure", "keep trying until", "loop until done", "don't stop until", or needs guaranteed completion of a task with explicit success criteria.` |

#### `skills/10-todo`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-todo.md](skills/10-todo/actions/01-todo.md) | - |
| `-` | [README.md](skills/10-todo/README.md) | - |
| `-` | [SKILL.md](skills/10-todo/SKILL.md) | `Split the user prompt into independent todos, run one implementer agent per todo in parallel (each refines its todo first), and report a minimal table. Use when the user says "todo", "/todo", or asks to fan out a multi-part request into parallel implementations.` |

