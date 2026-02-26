# AIDD Framework Catalog

Auto-generated framework content: agents, commands, rules, skills, and templates.

> This file is automatically updated by the `scripts/summarize-markdown.mjs` script.

## Table of Contents

- [`.github`](#github)
- [`.specstory`](#specstory)
- [`agents`](#agents)
- [`aidd_docs`](#aidd_docs)
  - [`aidd_docs/templates`](#aidd_docstemplates)
- [`commands`](#commands)
  - [`commands/00_behavior`](#commands00_behavior)
  - [`commands/01_onboard`](#commands01_onboard)
  - [`commands/02_context`](#commands02_context)
  - [`commands/03_plan`](#commands03_plan)
  - [`commands/04_code`](#commands04_code)
  - [`commands/05_review`](#commands05_review)
  - [`commands/06_tests`](#commands06_tests)
  - [`commands/07_documentation`](#commands07_documentation)
  - [`commands/08_deploy`](#commands08_deploy)
  - [`commands/09_refactor`](#commands09_refactor)
  - [`commands/10_maintenance`](#commands10_maintenance)
- [`config`](#config)
- [`rules`](#rules)
  - [`rules/01-standards`](#rules01-standards)
  - [`rules/04-tooling`](#rules04-tooling)
- [`scripts`](#scripts)
- [`skills`](#skills)
  - [`skills/aidd-auto-implement`](#skillsaidd-auto-implement)
  - [`skills/architecture-decision`](#skillsarchitecture-decision)
  - [`skills/architecture-impact`](#skillsarchitecture-impact)
  - [`skills/architecture-impact-plan`](#skillsarchitecture-impact-plan)
  - [`skills/architecture-milestones`](#skillsarchitecture-milestones)
  - [`skills/challenge`](#skillschallenge)
  - [`skills/challenge-methods`](#skillschallenge-methods)
  - [`skills/pm-change-brief`](#skillspm-change-brief)
  - [`skills/pm-change-spec`](#skillspm-change-spec)
  - [`skills/pm-constitution`](#skillspm-constitution)
  - [`skills/pm-prd`](#skillspm-prd)
  - [`skills/pm-product-brief`](#skillspm-product-brief)
  - [`skills/pm-system-overview`](#skillspm-system-overview)
  - [`skills/pm-user-stories`](#skillspm-user-stories)
  - [`skills/ux-accessibility`](#skillsux-accessibility)
  - [`skills/ux-accessibility-update`](#skillsux-accessibility-update)
  - [`skills/ux-audit`](#skillsux-audit)
  - [`skills/ux-copywriting`](#skillsux-copywriting)
  - [`skills/ux-copywriting-update`](#skillsux-copywriting-update)
  - [`skills/ux-design-system`](#skillsux-design-system)
  - [`skills/ux-design-system-update`](#skillsux-design-system-update)
  - [`skills/ux-flow-map`](#skillsux-flow-map)
  - [`skills/ux-flow-update`](#skillsux-flow-update)
- [`templates`](#templates)
  - [`templates/docs`](#templatesdocs)

---

### `.github`

No files found.
### `.specstory`

No files found.
### `agents`

| File | Description | Docs |
|------|---|---|
| [alexia.md](../../agents/alexia.md) | `Act like the USER to autonomously end-to-end implementation without human intervention` | - |
| [ariane.md](../../agents/ariane.md) | `Architect — handles technical architecture decisions and implementation planning` | - |
| [claire.md](../../agents/claire.md) | `Clarity challenger — challenges and questions until the request is ultra-clear` | - |
| [diane.md](../../agents/diane.md) | `UX Designer — handles design systems, user flows, accessibility, UX copy, and UX audits` | - |
| [eva.md](../../agents/eva.md) | `Impact Evaluator — evaluates the global impact of decisions and changes` | - |
| [iris.md](../../agents/iris.md) | `Frontend specialist with 3 modes - implement from Figma, verify UI conformity, validate user journeys.` | - |
| [justine.md](../../agents/justine.md) | `Challenger — challenges ideas, decisions, and deliverables using structured methods to ensure nothing is overlooked` | - |
| [kent.md](../../agents/kent.md) | `Use this agent when explicitly asked to perform test-driven development.` | `https://tidyfirst.substack.com/p/augmented-coding-beyond-the-vibes` |
| [martin.md](../../agents/martin.md) | `Every time you need to run a command to ensure code is correct, still builds are that tests pass, you must call this agent.` | - |
| [oriane.md](../../agents/oriane.md) | `PM Orchestrator — orchestrates all product workflows from idea to implementation-ready specification` | - |

### `aidd_docs`

| File |
|------|
| [CONTRIBUTING.md](../../aidd_docs/CONTRIBUTING.md) |
| [README.md](../../aidd_docs/README.md) |

#### `aidd_docs/templates`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `-` | [AGENTS.md](../../aidd_docs/templates/AGENTS.md) | `AI agent configuration and guidelines` | - |
| `aidd` | [agent.md](../../aidd_docs/templates/aidd/agent.md) | `<when-this-agent-needs-to-be-called>` | - |
| `aidd` | [agents_coordination.md](../../aidd_docs/templates/aidd/agents_coordination.md) | `Multi-agent coordination and workflows template` | - |
| `aidd` | [brownfield-plan.md](../../aidd_docs/templates/aidd/brownfield-plan.md) | `Brownfield workflow tracking plan` | - |
| `aidd` | [command.md](../../aidd_docs/templates/aidd/command.md) | `<generated-action-oriented-description>` | `<generated-argument-hint-if-applicable>` |
| `aidd` | [greenfield-plan.md](../../aidd_docs/templates/aidd/greenfield-plan.md) | `Greenfield workflow tracking plan` | - |
| `aidd` | [master_plan.md](../../aidd_docs/templates/aidd/master_plan.md) | `Parent plan template orchestrating multiple child plans with validation gates` | - |
| `aidd` | [plan.md](../../aidd_docs/templates/aidd/plan.md) | `Feature implementation plan template` | - |
| `aidd` | [prompt.md](../../aidd_docs/templates/aidd/prompt.md) | `Custom prompt template example` | - |
| `aidd` | [review_code.md](../../aidd_docs/templates/aidd/review_code.md) | - | - |
| `aidd` | [rule.md](../../aidd_docs/templates/aidd/rule.md) | `< One line. Comprehensive description that provides full context and clearly indicates when this rule should be applied. Include key scenarios, impacted areas, and why following this rule is important. While being thorough, remain focused and relevant. The description should be detailed enough that the agent can confidently determine whether to apply the rule in any given situation.>` | - |
| `aidd` | [skill.md](../../aidd_docs/templates/aidd/skill.md) | `<What it does - actions, capabilities>. Use when <trigger phrases, contexts, file types, user intents>.` | - |
| `aidd` | [task.md](../../aidd_docs/templates/aidd/task.md) | `Task tracking system to ensure all tasks are categorized and addressed` | - |
| `dev` | [adr.md](../../aidd_docs/templates/dev/adr.md) | `Architecture Decision Record template` | - |
| `dev` | [code_review.md](../../aidd_docs/templates/dev/code_review.md) | `Code review checklist and scoring template` | - |
| `dev` | [decision.md](../../aidd_docs/templates/dev/decision.md) | `Individual decision record template` | `<title>` |
| `dev` | [tech_choice.md](../../aidd_docs/templates/dev/tech_choice.md) | `Technology selection and comparison template` | - |
| `docs` | [CATALOG.md](../../aidd_docs/templates/docs/CATALOG.md) | - | - |
| `docs` | [INSTALL.md](../../aidd_docs/templates/docs/INSTALL.md) | - | - |
| `pm` | [brief.md](../../aidd_docs/templates/pm/brief.md) | - | - |
| `pm` | [challenge_report.md](../../aidd_docs/templates/pm/challenge_report.md) | - | - |
| `pm` | [change_brief.md](../../aidd_docs/templates/pm/change_brief.md) | `Change brief template for brownfield evolutions` | - |
| `pm` | [constitution.md](../../aidd_docs/templates/pm/constitution.md) | `Project constitution template - strategic framing document` | - |
| `pm` | [discovery_package.md](../../aidd_docs/templates/pm/discovery_package.md) | - | - |
| `pm` | [dod.md](../../aidd_docs/templates/pm/dod.md) | `Project-level Definition of Done applied to all user stories` | - |
| `pm` | [epic.md](../../aidd_docs/templates/pm/epic.md) | `Template for structuring an epic with its user stories, estimation and scope tier` | - |
| `pm` | [gap_report.md](../../aidd_docs/templates/pm/gap_report.md) | `Template for gap analysis report` | - |
| `pm` | [impact_report.md](../../aidd_docs/templates/pm/impact_report.md) | - | - |
| `pm` | [implementation_readiness.md](../../aidd_docs/templates/pm/implementation_readiness.md) | `Template for implementation readiness checklist and Go/No-Go decision` | - |
| `pm` | [interview_transcript.md](../../aidd_docs/templates/pm/interview_transcript.md) | - | - |
| `pm` | [jtbd.md](../../aidd_docs/templates/pm/jtbd.md) | - | - |
| `pm` | [milestones.md](../../aidd_docs/templates/pm/milestones.md) | `Template for deliverable milestones with go/no-go criteria` | - |
| `pm` | [persona.md](../../aidd_docs/templates/pm/persona.md) | - | - |
| `pm` | [post-mortem.md](../../aidd_docs/templates/pm/post-mortem.md) | `Issue tracking template with fix plan` | - |
| `pm` | [prd.md](../../aidd_docs/templates/pm/prd.md) | `Product Requirements Document template (16 sections)` | - |
| `pm` | [research_report.md](../../aidd_docs/templates/pm/research_report.md) | `Template for structured research findings` | - |
| `pm` | [system_overview.md](../../aidd_docs/templates/pm/system_overview.md) | - | - |
| `pm` | [user_story.md](../../aidd_docs/templates/pm/user_story.md) | `Template for defining user stories with estimation and acceptance criteria` | - |
| `ux` | [accessibility_spec.md](../../aidd_docs/templates/ux/accessibility_spec.md) | `Accessibility specification template — ARIA, keyboard, focus, contrast` | - |
| `ux` | [design_system.md](../../aidd_docs/templates/ux/design_system.md) | `Design system template — visual patterns, tokens, components, layouts` | - |
| `ux` | [user_flows.md](../../aidd_docs/templates/ux/user_flows.md) | `User flows template — flow diagrams, state tables, recovery paths` | - |
| `ux` | [ux_copy.md](../../aidd_docs/templates/ux/ux_copy.md) | `UX copy template — single source of truth for ALL user-facing text` | - |
| `vcs` | [branch.md](../../aidd_docs/templates/vcs/branch.md) | `VCS branch naming convention template` | - |
| `vcs` | [commit.md](../../aidd_docs/templates/vcs/commit.md) | `VCS commit message template` | - |
| `vcs` | [CONTRIBUTING.md](../../aidd_docs/templates/vcs/CONTRIBUTING.md) | `Project contribution guidelines template` | - |
| `vcs` | [issue.md](../../aidd_docs/templates/vcs/issue.md) | `VCS issue/ticket template` | - |
| `vcs` | [pull_request.md](../../aidd_docs/templates/vcs/pull_request.md) | `VCS pull/merge request template` | - |
| `vcs` | [README.md](../../aidd_docs/templates/vcs/README.md) | `Project README template` | - |
| `vcs` | [release.md](../../aidd_docs/templates/vcs/release.md) | `VCS release notes template` | - |

### `commands`

#### `commands/00_behavior`

| File | Description |
|------|---|
| [auto_accept.md](../../commands/00_behavior/auto_accept.md) | `Auto-accept proposed changes without asking for confirmation.` |

#### `commands/01_onboard`

| File | Description | Argument Hint |
|------|---|---|
| [generate_agent.md](../../commands/01_onboard/generate_agent.md) | `Generates a customized agent based on user-defined parameters.` | - |
| [generate_architecture.md](../../commands/01_onboard/generate_architecture.md) | `Generate project architecture with agents, skills, coordination diagram, and optional rules/commands for code projects` | `Project description and domain requirements` |
| [generate_command.md](../../commands/01_onboard/generate_command.md) | `Generate optimized, action-oriented prompts using best practices and structured template` | `The command details to generate the prompt for` |
| [generate_rules.md](../../commands/01_onboard/generate_rules.md) | `Generate or modify coding rules manually or auto-scan the codebase to propose rules` | `Rule topic to write, or 'auto' to scan codebase and propose rules` |
| [generate_skill.md](../../commands/01_onboard/generate_skill.md) | `Generate a customized skill based on repeated patterns and user workflows.` | `Description of the workflow to package as a skill` |
| [init.md](../../commands/01_onboard/init.md) | `Create or update the memory bank files to reflect the current state of the codebase` | - |

#### `commands/02_context`

| File | Description | Argument Hint |
|------|---|---|
| [brainstorm.md](../../commands/02_context/brainstorm.md) | `Interactive brainstorming session to clarify and refine feature requests` | - |
| [brownfield.md](../../commands/02_context/brownfield.md) | `Run the brownfield evolution workflow by chaining agents from change request to impact plan` | - |
| [challenge.md](../../commands/02_context/challenge.md) | `Rethink and challenge previous work for improvements` | - |
| [greenfield.md](../../commands/02_context/greenfield.md) | `Run the full greenfield workflow by chaining agents from idea to implementation plan` | - |
| [ticket_info.md](../../commands/02_context/ticket_info.md) | `Get ticket information from the project's ticketing tool` | `Ticket URL or number` |

#### `commands/03_plan`

| File | Description | Argument Hint |
|------|---|---|
| [components_behavior.md](../../commands/03_plan/components_behavior.md) | `Define the expected behavior of frontend components into a state machine format.` | `names of the components to define behavior for.` |
| [image_extract_details.md](../../commands/03_plan/image_extract_details.md) | `Analyze image to identify and extract main components with hierarchical organization` | `the image to analyze` |
| [plan.md](../../commands/03_plan/plan.md) | `Generate technical implementation plans from requirements` | `requirements (GitHub issue URL or raw text)` |

#### `commands/04_code`

| File | Description | Argument Hint |
|------|---|---|
| [assert_architecture.md](../../commands/04_code/assert_architecture.md) | `Verify code conforms to architecture diagrams, ADRs, and project structure.` | `[Optional scope to verify (module, service, or layer name)]` |
| [assert_frontend.md](../../commands/04_code/assert_frontend.md) | `Assert a frontend feature works as intended.` | `The frontend behavior you need to assert and validate.` |
| [assert.md](../../commands/04_code/assert.md) | `Assert that a feature must work as intended.` | - |
| [implement_from_design.md](../../commands/04_code/implement_from_design.md) | `Implement a frontend component from a Figma design with pixel-perfect accuracy.` | `The Figma file URL and frame/component to implement.` |
| [implement.md](../../commands/04_code/implement.md) | `Implement plan following project rules with validation` | `The technical plan to implement` |
| [run_projection.md](../../commands/04_code/run_projection.md) | `Project the solution you mentioned on a part of the codebase so we can see if this will work.` | - |

#### `commands/05_review`

| File | Description | Argument Hint |
|------|---|---|
| [feedback_loop.md](../../commands/05_review/feedback_loop.md) | `Verify that production feedback infrastructure is operational` | `Path to constitution or PRD for NSM reference` |
| [gap_analysis.md](../../commands/05_review/gap_analysis.md) | `Analyze specifications for gaps, inconsistencies and missing elements` | `Path to PRD or specifications to analyze` |
| [review_code.md](../../commands/05_review/review_code.md) | `Ensure code quality and rules compliance` | - |
| [review_functional.md](../../commands/05_review/review_functional.md) | `Use this agent when you need to browse current project web application, getting browser console, screenshot, navigating across the app...` | `The technical plan to base the review on` |

#### `commands/06_tests`

| File | Description | Argument Hint |
|------|---|---|
| [test_journey.md](../../commands/06_tests/test_journey.md) | `Test a user journey end-to-end by navigating and validating each step in the browser.` | `The user journey steps to validate and the URL to test on.` |
| [test.md](../../commands/06_tests/test.md) | `List untested behaviors and iterate on test creation until tests pass with best practices` | - |

#### `commands/07_documentation`

| File | Description |
|------|---|
| [learn.md](../../commands/07_documentation/learn.md) | `Update memory bank or rules with new information or requirements.` |
| [mermaid.md](../../commands/07_documentation/mermaid.md) | `When need to generate Mermaid diagrams` |

#### `commands/08_deploy`

| File | Description | Argument Hint |
|------|---|---|
| [commit.md](../../commands/08_deploy/commit.md) | `Create git commit with proper message format` | `auto` |
| [create_request.md](../../commands/08_deploy/create_request.md) | `Create PR (GitHub) or MR (GitLab) with filled template` | - |
| [tag.md](../../commands/08_deploy/tag.md) | `Create and push git tag with semantic versioning` | - |

#### `commands/09_refactor`

| File | Description | Argument Hint |
|------|---|---|
| [audit.md](../../commands/09_refactor/audit.md) | `Perform deep codebase analysis for technical debt and improvements` | `Scope to audit (optional - defaults to full codebase)` |
| [performance.md](../../commands/09_refactor/performance.md) | `Optimize code for better performance` | - |
| [security_refactor.md](../../commands/09_refactor/security_refactor.md) | `Identify and fix security vulnerabilities` | - |

#### `commands/10_maintenance`

| File | Description | Docs | Argument Hint |
|------|---|---|---|
| [debug.md](../../commands/10_maintenance/debug.md) | `Debug issue to find root cause.` | - | - |
| [new_issue.md](../../commands/10_maintenance/new_issue.md) | `Create GitHub issues with interactive template filling` | `https://github.com/steipete/agent-rules/blob/main/global-rules/github-issue-creation.mdc` | `Describe the problem you want to create an issue for` |
| [reflect_issue.md](../../commands/10_maintenance/reflect_issue.md) | `Reflect on possible sources, identify most likely causes, add validation logs before fixing` | - | - |
| [reproduce.md](../../commands/10_maintenance/reproduce.md) | `Fix bugs with test-driven workflow from issue to PR` | - | `Bug description or issue number` |

### `config`

No files found.
### `rules`

#### `rules/01-standards`

| File | Description |
|------|---|
| [1-command-structure.md](../../rules/01-standards/1-command-structure.md) | `Standards for naming, organizing, and writing command files. Apply when creating or editing any command file.` |
| [1-mermaid.md](../../rules/01-standards/1-mermaid.md) | `Rules for generating valid, high-quality Mermaid diagrams. Apply when creating or reviewing any Mermaid diagram (flowchart, state, ER, sequence, gantt).` |
| [1-rule-structure.md](../../rules/01-standards/1-rule-structure.md) | `Standards for naming and organizing .md rule files. Apply when creating new rule files or deciding on file placement.` |
| [1-rule-writing.md](../../rules/01-standards/1-rule-writing.md) | `Standards for writing .md coding rule content. Apply when creating, editing, or reviewing any rule file.` |

#### `rules/04-tooling`

| File | Description |
|------|---|
| [ide-mapping.claude.md](../../rules/04-tooling/ide-mapping.claude.md) | - |
| [ide-mapping.copilot.md](../../rules/04-tooling/ide-mapping.copilot.md) | - |
| [ide-mapping.cursor.md](../../rules/04-tooling/ide-mapping.cursor.md) | `Cursor file locations, syntax and frontmatter reference` |

### `scripts`

No files found.
### `skills`

#### `skills/aidd-auto-implement`

| File | Description | Argument Hint |
|------|---|---|
| [SKILL.md](../../skills/aidd-auto-implement/SKILL.md) | `Autonomously runs the AI-Driven Development workflow to implement a high-quality feature. Use when you need to code a feature end-to-end without manual intervention.` | `The URL or file path of the issue or task to implement.` |

#### `skills/architecture-decision`

| File | Description |
|------|---|
| [SKILL.md](../../skills/architecture-decision/SKILL.md) | `Generates justified architecture decisions from PRD and project constraints. Use when you need to make and document technical architecture choices for a new project.` |

#### `skills/architecture-impact`

| File | Description |
|------|---|
| [SKILL.md](../../skills/architecture-impact/SKILL.md) | `Analyzes the precise impact of a brownfield change on existing architecture. Use when you need to map impacted modules and plan migrations for an evolution.` |

#### `skills/architecture-impact-plan`

| File | Description |
|------|---|
| [SKILL.md](../../skills/architecture-impact-plan/SKILL.md) | `Generates a progressive rollout plan with feature flags, monitoring, and rollback. Use when you need a concrete deployment plan for a brownfield change.` |

#### `skills/architecture-milestones`

| File | Description |
|------|---|
| [SKILL.md](../../skills/architecture-milestones/SKILL.md) | `Extracts and sequences implementation milestones from PRD and backlog. Use when you need to break down a project into sequenced, deployable milestones.` |

#### `skills/challenge-methods`

| File | Description |
|------|---|
| [SKILL.md](../../skills/challenge-methods/SKILL.md) | `Provides 7 structured challenge techniques for validating deliverables. Use when you need to select the right challenge approach for a deliverable type.` |

#### `skills/pm-change-brief`

| File | Description |
|------|---|
| [SKILL.md](../../skills/pm-change-brief/SKILL.md) | `Generates a change brief documenting the as-is to to-be gap for a brownfield evolution. Use when you need to clarify what changes and what stays the same on an existing system.` |

#### `skills/pm-change-spec`

| File | Description |
|------|---|
| [SKILL.md](../../skills/pm-change-spec/SKILL.md) | `Generates detailed change specification and brownfield user stories from a change brief. Use when you need to specify what changes and what stays, with INVEST-compliant stories.` |

#### `skills/pm-constitution`

| File | Description |
|------|---|
| [SKILL.md](../../skills/pm-constitution/SKILL.md) | `Generates a project constitution from an initial idea and business context. Use when starting a new project to define vision, objectives, and constraints.` |

#### `skills/pm-prd`

| File | Description |
|------|---|
| [SKILL.md](../../skills/pm-prd/SKILL.md) | `Generates a comprehensive PRD from a validated product brief. Use when you need to transform a product brief into a full Product Requirements Document.` |

#### `skills/pm-product-brief`

| File | Description |
|------|---|
| [SKILL.md](../../skills/pm-product-brief/SKILL.md) | `Validates problem, personas, and market then generates a product brief. Use when you need to validate assumptions and create a structured product brief from a constitution.` |

#### `skills/pm-system-overview`

| File | Description |
|------|---|
| [SKILL.md](../../skills/pm-system-overview/SKILL.md) | `Analyzes an existing codebase and generates a pragmatic system overview. Use when starting a brownfield project to understand the current system state.` |

#### `skills/pm-user-stories`

| File | Description |
|------|---|
| [SKILL.md](../../skills/pm-user-stories/SKILL.md) | `Creates user stories through iterative questioning using the INVEST checklist. Use when you need well-structured user stories from feature requirements.` |

#### `skills/ux-accessibility`

| File | Description |
|------|---|
| [SKILL.md](../../skills/ux-accessibility/SKILL.md) | `Generates actionable accessibility specifications per component: ARIA, keyboard navigation, focus management, contrast. Use when you need a detailed a11y spec that developers can implement directly.` |

#### `skills/ux-accessibility-update`

| File | Description |
|------|---|
| [SKILL.md](../../skills/ux-accessibility-update/SKILL.md) | `Generates accessibility specifications for new and modified components in a brownfield change. Use when you need a11y specs scoped to a change, not the full product.` |

#### `skills/ux-audit`

| File | Description |
|------|---|
| [SKILL.md](../../skills/ux-audit/SKILL.md) | `Audits UX against Nielsen's 10 heuristics with severity scoring and prioritization matrix. Use when you need to evaluate an existing product's usability and identify improvements.` |

#### `skills/ux-copywriting`

| File | Description |
|------|---|
| [SKILL.md](../../skills/ux-copywriting/SKILL.md) | `Generates i18n-ready microcopy: voice & tone guidelines, error messages, empty states, tooltips, onboarding, CTAs. Use when you need consistent UX writing across the entire product.` |

#### `skills/ux-copywriting-update`

| File | Description |
|------|---|
| [SKILL.md](../../skills/ux-copywriting-update/SKILL.md) | `Generates i18n-ready microcopy for new and modified screens in a brownfield change. Use when you need UX copy scoped to a change, not the full product.` |

#### `skills/ux-design-system`

| File | Description |
|------|---|
| [SKILL.md](../../skills/ux-design-system/SKILL.md) | `Generates a design system with components, guidelines, and patterns from PRD user journeys. Use when you need to create UI/UX foundations for a new project.` |

#### `skills/ux-design-system-update`

| File | Description |
|------|---|
| [SKILL.md](../../skills/ux-design-system-update/SKILL.md) | `Audits existing UI patterns and generates a design system update plan for brownfield evolution. Use when you need to integrate new components without breaking visual consistency.` |

#### `skills/ux-flow-map`

| File | Description |
|------|---|
| [SKILL.md](../../skills/ux-flow-map/SKILL.md) | `Maps complete user flows with all states (happy, error, empty, loading, permission, offline, first-time). Use when you need to document every path a user can take through the product.` |

#### `skills/ux-flow-update`

| File | Description |
|------|---|
| [SKILL.md](../../skills/ux-flow-update/SKILL.md) | `Maps only the user flows impacted by a brownfield change, covering all states. Use when you need to document flow changes without remapping the entire product.` |

### `templates`

#### `templates/docs`

| File |
|------|
| [CATALOG.md](CATALOG.md) |

