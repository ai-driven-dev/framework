# AIDD Framework Catalog

Auto-generated framework content: agents, commands, rules, skills, and templates.

> This file is automatically updated by the `scripts/summarize-markdown.mjs` script.

## Table of Contents

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
- [`rules`](#rules)
  - [`rules/01-standards`](#rules01-standards)
  - [`rules/04-tooling`](#rules04-tooling)
- [`scripts`](#scripts)
- [`skills`](#skills)
  - [`skills/aidd-auto-implement`](#skillsaidd-auto-implement)
  - [`skills/challenge`](#skillschallenge)

---

### `agents`

| File | Description | Docs |
|------|---|---|
| [alexia.md](../agents/alexia.md) | `Act like the USER to autonomously end-to-end implementation without human intervention` | - |
| [claire.md](../agents/claire.md) | `Clarity challenger — challenges and questions until the request is ultra-clear` | - |
| [iris.md](../agents/iris.md) | `Frontend specialist with 3 modes - implement from Figma, verify UI conformity, validate user journeys.` | - |
| [kent.md](../agents/kent.md) | `Use this agent when explicitly asked to perform test-driven development.` | `https://tidyfirst.substack.com/p/augmented-coding-beyond-the-vibes` |
| [martin.md](../agents/martin.md) | `Every time you need to run a command to ensure code is correct, still builds are that tests pass, you must call this agent.` | - |

### `aidd_docs`

| File |
|------|
| [CATALOG.md](CATALOG.md) |
| [CONTRIBUTING.md](CONTRIBUTING.md) |
| [README.md](README.md) |

#### `aidd_docs/templates`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `-` | [AGENTS.md](templates/AGENTS.md) | `AI agent configuration and guidelines` | - |
| `aidd` | [agent.md](templates/aidd/agent.md) | `<when-this-agent-needs-to-be-called>` | - |
| `aidd` | [agents_coordination.md](templates/aidd/agents_coordination.md) | `Multi-agent coordination and workflows template` | - |
| `aidd` | [command.md](templates/aidd/command.md) | `<generated-action-oriented-description>` | `<generated-argument-hint-if-applicable>` |
| `aidd` | [master_plan.md](templates/aidd/master_plan.md) | `Parent plan template orchestrating multiple child plans with validation gates` | - |
| `aidd` | [plan.md](templates/aidd/plan.md) | `Feature implementation plan template` | - |
| `aidd` | [prompt.md](templates/aidd/prompt.md) | `Custom prompt template example` | - |
| `aidd` | [rule.md](templates/aidd/rule.md) | `< One line. Comprehensive description that provides full context and clearly indicates when this rule should be applied. Include key scenarios, impacted areas, and why following this rule is important. While being thorough, remain focused and relevant. The description should be detailed enough that the agent can confidently determine whether to apply the rule in any given situation.>` | - |
| `aidd` | [skill.md](templates/aidd/skill.md) | `<What it does - actions, capabilities>. Use when <trigger phrases, contexts, file types, user intents>.` | - |
| `aidd` | [task.md](templates/aidd/task.md) | `Task tracking system to ensure all tasks are categorized and addressed` | - |
| `dev` | [adr.md](templates/dev/adr.md) | `Architecture Decision Record template` | - |
| `dev` | [code_review.md](templates/dev/code_review.md) | `Code review checklist and scoring template` | - |
| `dev` | [decision.md](templates/dev/decision.md) | `Individual decision record template` | `<title>` |
| `dev` | [review_code.md](templates/dev/review_code.md) | `Code review checklist and scoring template` | - |
| `dev` | [tech_choice.md](templates/dev/tech_choice.md) | `Technology selection and comparison template` | - |
| `pm` | [prd.md](templates/pm/prd.md) | `Product Requirements Document template (15 sections)` | - |
| `pm` | [user_story.md](templates/pm/user_story.md) | `Template for defining user stories with estimation and acceptance criteria` | - |
| `vcs` | [branch.md](templates/vcs/branch.md) | `VCS branch naming convention template` | - |
| `vcs` | [commit.md](templates/vcs/commit.md) | `VCS commit message template` | - |
| `vcs` | [CONTRIBUTING.md](templates/vcs/CONTRIBUTING.md) | `Project contribution guidelines template` | - |
| `vcs` | [issue.md](templates/vcs/issue.md) | `VCS issue/ticket template` | - |
| `vcs` | [pull_request.md](templates/vcs/pull_request.md) | `VCS pull/merge request template` | - |
| `vcs` | [README.md](templates/vcs/README.md) | `Project README template` | - |
| `vcs` | [release.md](templates/vcs/release.md) | `VCS release notes template` | - |

### `commands`

#### `commands/00_behavior`

| File | Description |
|------|---|
| [auto_accept.md](../commands/00_behavior/auto_accept.md) | `Auto-accept proposed changes without asking for confirmation.` |

#### `commands/01_onboard`

| File | Description | Argument Hint |
|------|---|---|
| [generate_agent.md](../commands/01_onboard/generate_agent.md) | `Generates a customized agent based on user-defined parameters.` | - |
| [generate_architecture.md](../commands/01_onboard/generate_architecture.md) | `Generate project architecture with agents, skills, coordination diagram, and optional rules/commands for code projects` | `Project description and domain requirements` |
| [generate_command.md](../commands/01_onboard/generate_command.md) | `Generate optimized, action-oriented prompts using best practices and structured template` | `The command details to generate the prompt for` |
| [generate_rules.md](../commands/01_onboard/generate_rules.md) | `Generate or modify coding rules manually or auto-scan the codebase to propose rules` | `Rule topic to write, or 'auto' to scan codebase and propose rules` |
| [generate_skill.md](../commands/01_onboard/generate_skill.md) | `Generate a customized skill based on repeated patterns and user workflows.` | `Description of the workflow to package as a skill` |
| [init.md](../commands/01_onboard/init.md) | `Create or update the memory bank files to reflect the current state of the codebase` | - |

#### `commands/02_context`

| File | Description | Argument Hint |
|------|---|---|
| [brainstorm.md](../commands/02_context/brainstorm.md) | `Interactive brainstorming session to clarify and refine feature requests` | - |
| [challenge.md](../commands/02_context/challenge.md) | `Rethink and challenge previous work for improvements` | - |
| [create_user_stories.md](../commands/02_context/create_user_stories.md) | `Create user stories through iterative questioning` | `[Feature description or requirements for user story generation]` |
| [ticket_info.md](../commands/02_context/ticket_info.md) | `Get ticket information from the project's ticketing tool` | `[Ticket URL or number]` |

#### `commands/03_plan`

| File | Description | Argument Hint |
|------|---|---|
| [components_behavior.md](../commands/03_plan/components_behavior.md) | `Define the expected behavior of frontend components into a state machine format.` | `names of the components to define behavior for.` |
| [image_extract_details.md](../commands/03_plan/image_extract_details.md) | `Analyze image to identify and extract main components with hierarchical organization` | `the image to analyze` |
| [plan.md](../commands/03_plan/plan.md) | `Generate technical implementation plans from requirements` | `requirements (GitHub issue URL or raw text)` |

#### `commands/04_code`

| File | Description | Argument Hint |
|------|---|---|
| [assert_architecture.md](../commands/04_code/assert_architecture.md) | `Verify code conforms to architecture diagrams, ADRs, and project structure.` | `[Optional scope to verify (module, service, or layer name)]` |
| [assert_frontend.md](../commands/04_code/assert_frontend.md) | `Assert a frontend feature works as intended.` | `The frontend behavior you need to assert and validate.` |
| [assert.md](../commands/04_code/assert.md) | `Assert that a feature must work as intended.` | - |
| [implement_from_design.md](../commands/04_code/implement_from_design.md) | `Implement a frontend component from a Figma design with pixel-perfect accuracy.` | `The Figma file URL and frame/component to implement.` |
| [implement.md](../commands/04_code/implement.md) | `Implement plan following project rules with validation` | `The technical plan to implement` |
| [run_projection.md](../commands/04_code/run_projection.md) | `Project the solution you mentioned on a part of the codebase so we can see if this will work.` | - |

#### `commands/05_review`

| File | Description | Argument Hint |
|------|---|---|
| [review_code.md](../commands/05_review/review_code.md) | `Ensure code quality and rules compliance` | - |
| [review_functional.md](../commands/05_review/review_functional.md) | `Use this agent when you need to browse current project web application, getting browser console, screenshot, navigating across the app...` | `The technical plan to base the review on` |

#### `commands/06_tests`

| File | Description | Argument Hint |
|------|---|---|
| [test_journey.md](../commands/06_tests/test_journey.md) | `Test a user journey end-to-end by navigating and validating each step in the browser.` | `The user journey steps to validate and the URL to test on.` |
| [test.md](../commands/06_tests/test.md) | `List untested behaviors and iterate on test creation until tests pass with best practices` | `[things you want to test]` |

#### `commands/07_documentation`

| File | Description |
|------|---|
| [learn.md](../commands/07_documentation/learn.md) | `Update memory bank or rules with new information or requirements.` |
| [mermaid.md](../commands/07_documentation/mermaid.md) | `When need to generate Mermaid diagrams` |

#### `commands/08_deploy`

| File | Description | Argument Hint |
|------|---|---|
| [commit.md](../commands/08_deploy/commit.md) | `Create git commit with proper message format` | `auto` |
| [create_request.md](../commands/08_deploy/create_request.md) | `Create PR (GitHub) or MR (GitLab) with filled template` | - |
| [tag.md](../commands/08_deploy/tag.md) | `Create and push git tag with semantic versioning` | - |

#### `commands/09_refactor`

| File | Description | Argument Hint |
|------|---|---|
| [audit.md](../commands/09_refactor/audit.md) | `Perform deep codebase analysis for technical debt and improvements` | `Scope to audit (optional - defaults to full codebase)` |
| [performance.md](../commands/09_refactor/performance.md) | `Optimize code for better performance` | - |
| [security_refactor.md](../commands/09_refactor/security_refactor.md) | `Identify and fix security vulnerabilities` | - |

#### `commands/10_maintenance`

| File | Description | Docs | Argument Hint |
|------|---|---|---|
| [debug.md](../commands/10_maintenance/debug.md) | `Debug issue to find root cause.` | - | - |
| [new_issue.md](../commands/10_maintenance/new_issue.md) | `Create GitHub issues with interactive template filling` | `https://github.com/steipete/agent-rules/blob/main/global-rules/github-issue-creation.mdc` | `Describe the problem you want to create an issue for` |
| [reflect_issue.md](../commands/10_maintenance/reflect_issue.md) | `Reflect on possible sources, identify most likely causes, add validation logs before fixing` | - | - |
| [reproduce.md](../commands/10_maintenance/reproduce.md) | `Fix bugs with test-driven workflow from issue to PR` | - | `Bug description or issue number` |

### `rules`

#### `rules/01-standards`

| File | Description |
|------|---|
| [1-command-structure.md](../rules/01-standards/1-command-structure.md) | `Standards for naming, organizing, and writing command files. Apply when creating or editing any command file.` |
| [1-mermaid.md](../rules/01-standards/1-mermaid.md) | `Rules for generating valid, high-quality Mermaid diagrams. Apply when creating or reviewing any Mermaid diagram (flowchart, state, ER, sequence, gantt).` |
| [1-rule-structure.md](../rules/01-standards/1-rule-structure.md) | `Standards for naming and organizing .md rule files. Apply when creating new rule files or deciding on file placement.` |
| [1-rule-writing.md](../rules/01-standards/1-rule-writing.md) | `Standards for writing .md coding rule content. Apply when creating, editing, or reviewing any rule file.` |

#### `rules/04-tooling`

| File | Description |
|------|---|
| [ide-mapping.claude.md](../rules/04-tooling/ide-mapping.claude.md) | - |
| [ide-mapping.copilot.md](../rules/04-tooling/ide-mapping.copilot.md) | - |
| [ide-mapping.cursor.md](../rules/04-tooling/ide-mapping.cursor.md) | `Cursor file locations, syntax and frontmatter reference` |

### `scripts`

| File |
|------|
| [aidd.sh](../scripts/aidd.sh) |

### `skills`

#### `skills/aidd-auto-implement`

| File | Description | Argument Hint |
|------|---|---|
| [SKILL.md](../skills/aidd-auto-implement/SKILL.md) | `Autonomously run the AI-Driven Development workflow to code an high quality feature.` | `The URL or file path of the issue or task to implement.` |

#### `skills/challenge`

| File | Description |
|------|---|
| [SKILL.md](../skills/challenge/SKILL.md) | `Review and challenge previous work for improvements and correctness. Use when the user says 'challenge this', 'review my work', 'is this correct', asks for a critical review, or wants to rethink a decision.` |

