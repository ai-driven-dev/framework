# aidd-dev catalog

Auto-generated index of skills, agents, references and assets shipped by the `aidd-dev` plugin.

> This file is automatically updated by the `scripts/summarize-markdown.mjs` script.

## Table of Contents

- [`.claude-plugin`](#claude-plugin)
- [`agents`](#agents)
- [`skills`](#skills)
  - [`skills/00-sdlc`](#skills00-sdlc)
  - [`skills/01-plan`](#skills01-plan)
  - [`skills/02-assert`](#skills02-assert)
  - [`skills/03-audit`](#skills03-audit)
  - [`skills/04-review`](#skills04-review)
  - [`skills/05-test`](#skills05-test)
  - [`skills/06-refactor`](#skills06-refactor)
  - [`skills/07-debug`](#skills07-debug)
  - [`skills/08-for-sure`](#skills08-for-sure)

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

| File | Description |
|------|---|
| [SKILL.md](skills/00-sdlc/SKILL.md) | `Pure orchestrator for the full AIDD development flow. Use when a human (or Gardener) needs to take a free-form request from idea to shipped code, end-to-end. Coordinates spec generation, planning, implementation, and review by composing other skills and agents. Holds no business logic of its own — every step is delegated.` |

#### `skills/01-plan`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `actions` | [01-plan.md](skills/01-plan/actions/01-plan.md) | `Generate technical implementation plans from requirements` | `requirements (ticket URL or raw text)` |
| `actions` | [02-components-behavior.md](skills/01-plan/actions/02-components-behavior.md) | `Define the expected behavior of frontend components into a state machine format.` | `names of the components to define behavior for.` |
| `actions` | [03-image-extract-details.md](skills/01-plan/actions/03-image-extract-details.md) | `Analyze image to identify and extract main components with hierarchical organization` | `the image to analyze` |
| `assets` | [master-plan-template.md](skills/01-plan/assets/master-plan-template.md) | `Parent plan template orchestrating multiple child plans with validation gates` | - |
| `assets` | [plan-template.md](skills/01-plan/assets/plan-template.md) | `Living implementation plan — frozen objective, phases, and append-only execution Log. Used as input artifact AND as the autonomous-loop tracking file.` | - |
| `assets` | [tech-choice-template.md](skills/01-plan/assets/tech-choice-template.md) | `Technology selection and comparison template` | - |
| `references` | [mermaid-conventions.md](skills/01-plan/references/mermaid-conventions.md) | `Rules for generating valid, high-quality Mermaid diagrams. Apply when creating or reviewing any Mermaid diagram (flowchart, state, ER, sequence, gantt).` | - |
| `-` | [SKILL.md](skills/01-plan/SKILL.md) | `Generate technical implementation plans, define component behaviors, and extract design details from images.` | - |

#### `skills/02-assert`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `actions` | [01-assert.md](skills/02-assert/actions/01-assert.md) | `Assert that a feature must work as intended.` | - |
| `actions` | [02-assert-architecture.md](skills/02-assert/actions/02-assert-architecture.md) | `Verify code conforms to architecture diagrams, ADRs, and project structure.` | `[Optional scope to verify (module, service, or layer name)]` |
| `actions` | [03-assert-frontend.md](skills/02-assert/actions/03-assert-frontend.md) | `Assert a frontend feature works as intended.` | `The frontend behavior you need to assert and validate.` |
| `assets` | [task-template.md](skills/02-assert/assets/task-template.md) | `Task tracking system to ensure all tasks are categorized and addressed` | - |
| `-` | [SKILL.md](skills/02-assert/SKILL.md) | `Assert features work as intended — general assertions, architecture conformance, and frontend UI validation.` | - |

#### `skills/03-audit`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `actions` | [01-audit.md](skills/03-audit/actions/01-audit.md) | `Perform deep codebase analysis for technical debt and improvements` | `Scope to audit (optional - defaults to full codebase)` |
| `-` | [SKILL.md](skills/03-audit/SKILL.md) | `Perform deep codebase analysis to identify technical debt, dead code, and improvement opportunities.` | - |

#### `skills/04-review`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `actions` | [01-review-code.md](skills/04-review/actions/01-review-code.md) | `Ensure code quality and rules compliance` | - |
| `actions` | [02-review-functional.md](skills/04-review/actions/02-review-functional.md) | `Review feature behavior against plan specification and current diff` | `Plan path to validate against` |
| `assets` | [code-review-template.md](skills/04-review/assets/code-review-template.md) | `Code review checklist and scoring template` | - |
| `assets` | [review-functional-template.md](skills/04-review/assets/review-functional-template.md) | `Functional review report template` | - |
| `assets` | [review-template.md](skills/04-review/assets/review-template.md) | `Code review checklist and scoring template` | - |
| `-` | [SKILL.md](skills/04-review/SKILL.md) | `Review code quality against project rules and validate feature behavior against plan specifications.` | - |

#### `skills/05-test`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `actions` | [01-test.md](skills/05-test/actions/01-test.md) | `List untested behaviors and iterate on test creation until tests pass with best practices` | `[things you want to test]` |
| `actions` | [02-test-journey.md](skills/05-test/actions/02-test-journey.md) | `Test a user journey end-to-end by navigating and validating each step in the browser.` | `The user journey steps to validate and the URL to test on.` |
| `-` | [SKILL.md](skills/05-test/SKILL.md) | `Write and iterate on tests until they pass, and validate user journeys end-to-end in the browser.` | - |

#### `skills/06-refactor`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-performance.md](skills/06-refactor/actions/01-performance.md) | `Optimize code for better performance` |
| `actions` | [02-security.md](skills/06-refactor/actions/02-security.md) | `Identify and fix security vulnerabilities` |
| `-` | [SKILL.md](skills/06-refactor/SKILL.md) | `Optimize code for performance and fix security vulnerabilities following OWASP guidelines.` |

#### `skills/07-debug`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `actions` | [01-reproduce.md](skills/07-debug/actions/01-reproduce.md) | `Fix bugs with test-driven workflow from issue to PR` | `Bug description or issue number` |
| `actions` | [02-debug.md](skills/07-debug/actions/02-debug.md) | `Debug issue to find root cause.` | - |
| `actions` | [03-reflect-issue.md](skills/07-debug/actions/03-reflect-issue.md) | `Reflect on possible sources, identify most likely causes, add validation logs before fixing` | - |
| `assets` | [task-template.md](skills/07-debug/assets/task-template.md) | `Task tracking system to ensure all tasks are categorized and addressed` | - |
| `references` | [mermaid-conventions.md](skills/07-debug/references/mermaid-conventions.md) | `Rules for generating valid, high-quality Mermaid diagrams. Apply when creating or reviewing any Mermaid diagram (flowchart, state, ER, sequence, gantt).` | - |
| `-` | [SKILL.md](skills/07-debug/SKILL.md) | `Reproduce and fix bugs systematically using test-driven workflow, root cause analysis, and hypothesis validation.` | - |

#### `skills/08-for-sure`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-init-tracking.md](skills/08-for-sure/actions/01-init-tracking.md) | - |
| `actions` | [02-auto-accept.md](skills/08-for-sure/actions/02-auto-accept.md) | `Auto-accept all prompts and act autonomously without asking for confirmation. Use when the user says 'just do it', 'don''t ask me', 'auto-accept', 'install this from', or provides a URL with an implicit 'handle everything' intent.` |
| `actions` | [03-autonomous-loop.md](skills/08-for-sure/actions/03-autonomous-loop.md) | - |
| `-` | [SKILL.md](skills/08-for-sure/SKILL.md) | `Iterative agent loop that tracks attempts and retries until a success condition is met. Use when the user says "for sure", "make sure", "keep trying until", "loop until done", "don't stop until", or needs guaranteed completion of a task with explicit success criteria.` |

