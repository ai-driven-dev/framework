# Skill Catalog

The exhaustive list of AIDD plugins, skills, and actions. Skills are invoked through your AI tool by their `plugin:NN-slug` name (slash command, MCP, or natural-language trigger). Actions are the internal steps a skill runs; you do not call them directly.

- [aidd-context](#aidd-context) - knowledge production
- [aidd-dev](#aidd-dev) - code transformation
- [aidd-pm](#aidd-pm) - product management
- [aidd-refine](#aidd-refine) - meta-cognition
- [aidd-vcs](#aidd-vcs) - version control workflows
- [aidd-orchestrator](#aidd-orchestrator) - async orchestration (optional)

---

## aidd-context

Bootstrap, project init, context-artifact generation, diagrams, learning, and exploration.

| Skill                  | Role                                                                          | Actions                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `00-onboard`           | Detect project state and open a hub of project actions                        | `01-detect-state`, `02-recommend-next`, `03-execute-or-handoff`                                          |
| `01-bootstrap`         | Imagine and validate a new SaaS architecture, output an `INSTALL.md`          | `01-gather-needs`, `02-propose-candidates`, `03-audit-candidates`, `04-pick-and-design`, `05-write-install-md` |
| `02-project-memory`      | Initialize or refresh the memory bank and AI context files                    | `01-init-context-file`, `02-scaffold-docs`, `03-generate-memory`, `04-review-memory`, `05-sync-memory`  |
| `03-context-generate`  | Generate context artifacts across the host AI tool(s)                         | sub-generators: `agents`, `commands`, `hooks`, `marketplaces`, `plugins`, `rules`, `skills`             |
| `04-mermaid`           | Generate Mermaid diagrams via a plan-validate workflow                        | `01-mermaid`                                                                                             |
| `05-learn`             | Capture learnings, conventions, and decisions into memory, decisions, rules   | `01-scope`, `02-write`, `03-sync`                                                                        |
| `11-explore`           | Survey the project across tooling, context, and codebase, then drill into one axis | `01-survey`, `02-drill`                                                                                  |

## aidd-dev

The development SDLC: plan, implement, assert, audit, review, test, refactor, debug.

| Skill           | Role                                                                       | Actions                                                                         |
| --------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `00-sdlc`       | Pure orchestrator driving the full dev flow end to end                     | `01-spec`, `02-plan`, `03-implement`, `04-review`, `05-ship`                     |
| `01-plan`       | Technical implementation plans, component behavior, image extraction       | `01-plan`, `02-components-behavior`, `03-image-extract-details`                  |
| `02-implement`  | Execute a plan phase by phase until 100% complete                          | `01-implement`                                                                   |
| `03-assert`     | Assert features work - general, architecture, frontend UI                  | `01-assert`, `02-assert-architecture`, `03-assert-frontend`                      |
| `04-audit`      | Read-only codebase audit across quality pillars                            | `01-code-quality`, `02-architecture`, `03-security`, `04-dependencies`, `05-performance`, `06-tests`, `07-ui` |
| `05-review`     | Read-only review of a diff - code quality and feature behavior             | `01-review-code`, `02-review-functional`                                         |
| `06-test`       | Write and iterate tests, validate user journeys in the browser             | `01-test`, `02-test-journey`                                                     |
| `07-refactor`   | Improve code without changing behavior across four axes                    | `01-performance`, `02-security`, `03-cleanup`, `04-architecture`                 |
| `08-debug`      | Reproduce and fix bugs with a test-driven workflow                         | `01-reproduce`, `02-debug`, `03-reflect-issue`                                   |
| `09-for-sure`   | Iterative loop that retries until a success condition is met               | `01-init-tracking`, `02-auto-accept`, `03-autonomous-loop`                       |

## aidd-pm

Product management: ticket retrieval, user stories, PRD, spec.

| Skill                     | Role                                                       | Actions                          |
| ------------------------- | ---------------------------------------------------------- | -------------------------------- |
| `01-ticket-info`          | Retrieve and display ticket information                    | `01-ticket-info`                 |
| `02-user-stories-create`  | Generate INVEST-compliant user stories                     | `01-create-user-stories`         |
| `03-prd`                  | Generate a structured Product Requirements Document        | `01-prd`                         |
| `04-spec`                 | Generate or refine a normalized project spec               | `01-build`, `02-refine`          |

## aidd-refine

Meta-cognition: brainstorm, challenge, condense, blind-spot scan, fact-check.

| Skill              | Role                                                        | Actions                                                                                       |
| ------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `01-brainstorm`    | Clarify and refine a request through iterative questioning | `01-capture-request`, `02-ask-probing-questions`, `03-integrate-answers`, `04-refine-and-validate`, `05-confirm-approval` |
| `02-challenge`     | Rethink prior work to verify correctness against a plan    | `01-challenge`                                                                                |
| `03-condense`      | Toggle terse output mode and report token savings          | `01-condense`, `02-stats`                                                                     |
| `04-shadow-areas`  | Scan a markdown artifact for blind spots                   | `01-detect`, `02-render-report`, `03-diff`                                                    |
| `05-fact-check`    | Verify factual claims against sources and cite them        | `01-identify-claims`, `02-verify`, `03-report`                                                |

## aidd-vcs

Version-control workflows: commit, pull/merge request, release tag, issue.

| Skill              | Role                                                | Actions             |
| ------------------ | --------------------------------------------------- | ------------------- |
| `01-commit`        | Create an atomic conventional commit                | `01-commit`         |
| `02-pull-request`  | Create a draft pull or merge request                | `01-pull-request`   |
| `03-release-tag`   | Cut a semver release with annotated tag and notes   | `01-release-tag`    |
| `04-issue-create`  | Create an issue in the configured ticketing tool    | `01-issue-create`   |

## aidd-orchestrator

Optional. Runs the SDLC asynchronously on labeled issues (webhook or cron). Most projects do not need it.

| Skill            | Role                                                  | Sub-flows                 |
| ---------------- | ----------------------------------------------------- | ------------------------- |
| `00-async-dev`   | Single entry point for the async-dev pipeline         | `setup`, `run`, `review`  |
