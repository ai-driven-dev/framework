# AIDD Framework Catalog

Auto-generated framework content: agents, commands, rules, skills, and templates.

> This file is automatically updated by `aidd`.

## Table of Contents

- [agents](#agents)
- [aidd_docs](#aidd_docs)
  - [aidd_docs/templates](#aidd_docstemplates)
- [commands](#commands)
  - [commands/00_behavior](#commands00_behavior)
  - [commands/01_onboard](#commands01_onboard)
  - [commands/02_context](#commands02_context)
  - [commands/03_plan](#commands03_plan)
  - [commands/04_code](#commands04_code)
  - [commands/05_review](#commands05_review)
  - [commands/06_tests](#commands06_tests)
  - [commands/07_documentation](#commands07_documentation)
  - [commands/08_deploy](#commands08_deploy)
  - [commands/09_refactor](#commands09_refactor)
  - [commands/10_maintenance](#commands10_maintenance)
- [rules](#rules)
  - [rules/01-standards](#rules01-standards)
  - [rules/04-tooling](#rules04-tooling)
- [skills](#skills)
  - [skills/aidd-auto-implement](#skillsaidd-auto-implement)
  - [skills/challenge](#skillschallenge)

---

### `agents`

| File | Description |
|------|---|
| [alexia.md](../.claude/agents/alexia.md) | `Act like the USER to autonomously end-to-end implementation without human intervention` |
| [claire.md](../.claude/agents/claire.md) | `Clarity challenger — challenges and questions until the request is ultra-clear` |
| [iris.md](../.claude/agents/iris.md) | `Frontend specialist with 3 modes - implement from Figma, verify UI conformity, validate user journeys.` |
| [kent.md](../.claude/agents/kent.md) | `Use this agent when explicitly asked to perform test-driven development.` |
| [martin.md](../.claude/agents/martin.md) | `Every time you need to run a command to ensure code is correct, still builds are that tests pass, you must call this agent.` |

### `aidd_docs`

#### `aidd_docs/templates`

| File | Description |
|------|---|
| [AGENTS.md](../CLAUDE.md) | `AI agent configuration and guidelines` |

### `commands`

#### `commands/00_behavior`

| File | Description |
|------|---|
| [auto_accept.md](../.claude/commands/aidd/00/auto_accept.md) | `Auto-accept proposed changes without asking for confirmation.` |

#### `commands/01_onboard`

| File | Description | Argument Hint |
|------|---|---|
| [generate_agent.md](../.claude/commands/aidd/01/generate_agent.md) | `Generates a customized agent based on user-defined parameters.` | - |
| [generate_architecture.md](../.claude/commands/aidd/01/generate_architecture.md) | `Generate project architecture with agents, skills, coordination diagram, and optional rules/commands for code projects` | `Project description and domain requirements` |
| [generate_command.md](../.claude/commands/aidd/01/generate_command.md) | `Generate optimized, action-oriented prompts using best practices and structured template` | `The command details to generate the prompt for` |
| [generate_rules.md](../.claude/commands/aidd/01/generate_rules.md) | `Generate or modify coding rules manually or auto-scan the codebase to propose rules` | `Rule topic to write, or 'auto' to scan codebase and propose rules` |
| [generate_skill.md](../.claude/commands/aidd/01/generate_skill.md) | `Generate a customized skill based on repeated patterns and user workflows.` | `Description of the workflow to package as a skill` |
| [init.md](../.claude/commands/aidd/01/init.md) | `Create or update the memory bank files to reflect the current state of the codebase` | - |
| [onboard.md](../.claude/commands/aidd/01/onboard.md) | `Detect project state and tell the user exactly what to run next` | - |

#### `commands/02_context`

| File | Description | Argument Hint |
|------|---|---|
| [brainstorm.md](../.claude/commands/aidd/02/brainstorm.md) | `Interactive brainstorming session to clarify and refine feature requests` | - |
| [challenge.md](../.claude/commands/aidd/02/challenge.md) | `Rethink and challenge previous work for improvements` | - |
| [create_user_stories.md](../.claude/commands/aidd/02/create_user_stories.md) | `Create user stories through iterative questioning` | `[Feature description or requirements for user story generation]` |
| [ticket_info.md](../.claude/commands/aidd/02/ticket_info.md) | `Get ticket information from the project's ticketing tool` | `[Ticket URL or number]` |

#### `commands/03_plan`

| File | Description | Argument Hint |
|------|---|---|
| [components_behavior.md](../.claude/commands/aidd/03/components_behavior.md) | `Define the expected behavior of frontend components into a state machine format.` | `names of the components to define behavior for.` |
| [image_extract_details.md](../.claude/commands/aidd/03/image_extract_details.md) | `Analyze image to identify and extract main components with hierarchical organization` | `the image to analyze` |
| [plan.md](../.claude/commands/aidd/03/plan.md) | `Generate technical implementation plans from requirements` | `requirements (ticket URL or raw text)` |

#### `commands/04_code`

| File | Description | Argument Hint |
|------|---|---|
| [assert.md](../.claude/commands/aidd/04/assert.md) | `Assert that a feature must work as intended.` | - |
| [assert_architecture.md](../.claude/commands/aidd/04/assert_architecture.md) | `Verify code conforms to architecture diagrams, ADRs, and project structure.` | `[Optional scope to verify (module, service, or layer name)]` |
| [assert_frontend.md](../.claude/commands/aidd/04/assert_frontend.md) | `Assert a frontend feature works as intended.` | `The frontend behavior you need to assert and validate.` |
| [implement.md](../.claude/commands/aidd/04/implement.md) | `Implement plan following project rules with validation` | `The technical plan to implement` |
| [implement_from_design.md](../.claude/commands/aidd/04/implement_from_design.md) | `Implement a frontend component from a Figma design with pixel-perfect accuracy.` | `The Figma file URL and frame/component to implement.` |
| [run_projection.md](../.claude/commands/aidd/04/run_projection.md) | `Project the solution you mentioned on a part of the codebase so we can see if this will work.` | - |

#### `commands/05_review`

| File | Description | Argument Hint |
|------|---|---|
| [review_code.md](../.claude/commands/aidd/05/review_code.md) | `Ensure code quality and rules compliance` | - |
| [review_functional.md](../.claude/commands/aidd/05/review_functional.md) | `Use this agent when you need to browse current project web application, getting browser console, screenshot, navigating across the app...` | `The technical plan to base the review on` |

#### `commands/06_tests`

| File | Description | Argument Hint |
|------|---|---|
| [test.md](../.claude/commands/aidd/06/test.md) | `List untested behaviors and iterate on test creation until tests pass with best practices` | `[things you want to test]` |
| [test_journey.md](../.claude/commands/aidd/06/test_journey.md) | `Test a user journey end-to-end by navigating and validating each step in the browser.` | `The user journey steps to validate and the URL to test on.` |

#### `commands/07_documentation`

| File | Description |
|------|---|
| [learn.md](../.claude/commands/aidd/07/learn.md) | `Update memory bank or rules with new information or requirements.` |
| [mermaid.md](../.claude/commands/aidd/07/mermaid.md) | `When need to generate Mermaid diagrams` |

#### `commands/08_deploy`

| File | Description | Argument Hint |
|------|---|---|
| [commit.md](../.claude/commands/aidd/08/commit.md) | `Create git commit with proper message format` | `auto` |
| [create_request.md](../.claude/commands/aidd/08/create_request.md) | `Create PR (GitHub) or MR (GitLab) with filled template` | - |
| [tag.md](../.claude/commands/aidd/08/tag.md) | `Create and push git tag with semantic versioning` | - |

#### `commands/09_refactor`

| File | Description | Argument Hint |
|------|---|---|
| [audit.md](../.claude/commands/aidd/09/audit.md) | `Perform deep codebase analysis for technical debt and improvements` | `Scope to audit (optional - defaults to full codebase)` |
| [performance.md](../.claude/commands/aidd/09/performance.md) | `Optimize code for better performance` | - |
| [security_refactor.md](../.claude/commands/aidd/09/security_refactor.md) | `Identify and fix security vulnerabilities` | - |

#### `commands/10_maintenance`

| File | Description | Argument Hint |
|------|---|---|
| [debug.md](../.claude/commands/aidd/10/debug.md) | `Debug issue to find root cause.` | - |
| [new_issue.md](../.claude/commands/aidd/10/new_issue.md) | `Create issues in the configured ticketing tool` | `Describe the problem you want to create an issue for` |
| [reflect_issue.md](../.claude/commands/aidd/10/reflect_issue.md) | `Reflect on possible sources, identify most likely causes, add validation logs before fixing` | - |
| [reproduce.md](../.claude/commands/aidd/10/reproduce.md) | `Fix bugs with test-driven workflow from issue to PR` | `Bug description or issue number` |

### `rules`

#### `rules/01-standards`

| File | Description | Paths |
|------|---|---|
| [1-command-structure.md](../.claude/rules/01-standards/1-command-structure.md) | `Standards for naming, organizing, and writing command files. Apply when creating or editing any command file.` | - |
| [1-mermaid.md](../.claude/rules/01-standards/1-mermaid.md) | - | `**/*.mmd,**/*.md` |
| [1-rule-structure.md](../.claude/rules/01-standards/1-rule-structure.md) | - | `.claude/rules/**/*.md,.claude/rules/**/*.mdc` |
| [1-rule-writing.md](../.claude/rules/01-standards/1-rule-writing.md) | - | `.claude/rules/**/*.md,.claude/rules/**/*.mdc` |

#### `rules/04-tooling`

| File | Description |
|------|---|
| [ide-mapping.claude.md](../.claude/rules/04-tooling/ide-mapping.md) | `Claude Code file locations, syntax, frontmatter, and include patterns reference. Apply when creating or configuring Claude-specific files.` |

### `skills`

#### `skills/aidd-auto-implement`

| File | Description | Argument Hint |
|------|---|---|
| [SKILL.md](../.claude/skills/aidd-auto-implement/SKILL.md) | `Autonomously run the AI-Driven Development workflow to code an high quality feature.` | `The URL or file path of the issue or task to implement.` |

#### `skills/challenge`

| File | Description |
|------|---|
| [SKILL.md](../.claude/skills/challenge/SKILL.md) | `Review and challenge previous work for improvements and correctness. Use when the user says 'challenge this', 'review my work', 'is this correct', asks for a critical review, or wants to rethink a decision.` |

