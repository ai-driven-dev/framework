# AIDD Catalog — {{TOOL_NAME}}

Full reference of agents, commands, rules, skills, and templates installed by the framework.

## Commands Reference

### Context & Discovery

| Command                | Description                                        |
| ---------------------- | -------------------------------------------------- |
| `/brainstorm`          | Clarify a need through interactive brainstorming   |
| `/interview`           | Conduct a stakeholder interview                    |
| `/generate_prd`        | Generate or update a Product Requirements Document |
| `/create_user_stories` | Create user stories through iterative questioning  |
| `/extract_brief`       | Extract light Brief from brain dump                |

### Planning

| Command                | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `/plan`                | Generate technical implementation plan          |
| `/components_behavior` | Define expected behavior of frontend components |

### Implementation

| Command      | Description                                     |
| ------------ | ----------------------------------------------- |
| `/implement` | Implement a validated plan                      |
| `/assert`    | Verify that a feature works as intended         |
| `/isolate`   | Create an isolated worktree for multi-task work |

### Review & Deploy

| Command              | Description                                    |
| -------------------- | ---------------------------------------------- |
| `/review_code`       | Technical review (rules, quality)              |
| `/review_functional` | Behavioral review (business requirements)      |
| `/commit`            | Create a git commit with proper message format |
| `/create_request`    | Create a pull request or merge request         |

### Documentation & Maintenance

| Command      | Description                                      |
| ------------ | ------------------------------------------------ |
| `/learn`     | Update memory bank or rules with new information |
| `/new_issue` | Create a GitHub issue                            |
| `/debug`     | Debug an issue to find root cause                |
| `/reproduce` | Fix bugs with test-driven workflow               |

## Agents

| Agent   | Role                      | When to use                        |
| ------- | ------------------------- | ---------------------------------- |
| @alexia | Autonomous implementation | End-to-end feature delivery        |
| @claire | Product discovery         | Fuzzy idea → validated brief       |
| @roman  | Backlog generation        | PRD → implementation-ready backlog |
| @kent   | TDD & Tidy First          | Strict testing discipline          |
| @iris   | Frontend specialist       | UI implementation + validation     |
| @martin | Code quality              | Build, lint, tests validation      |

## What's Installed

The framework installs the following content in your tool's folder:

### Agents

Specialized AI agents in `{{AGENTS_DIR}}` that can be invoked by name (`@agent_name`). Each agent has a defined role, responsibilities, and instruction set.

### Commands

Commands in `{{COMMANDS_DIR}}` organized across 10 SDLC phases (onboarding, context, planning, implementation, review, testing, documentation, deployment, refactoring, maintenance). Invoked with `/command_name`.

### Rules

Coding rules in `{{RULES_DIR}}` that the AI follows automatically. Rules can be scoped to specific file patterns or apply globally. Organized by category (standards, programming languages, frameworks, tooling, testing, design patterns, quality, domain).

### Skills

Reusable multi-step workflows in `{{SKILLS_DIR}}` that the AI loads automatically when triggered. Skills package repeated instructions into a single file (e.g., batch issue processing).

### Templates

Scaffolds in `{{DOCS}}/templates/` used by generate commands and as reference documents.

#### `aidd/` — Framework scaffolds

Used by `/generate_*` commands to create new agents, commands, rules, and skills.

| File                     | Purpose                               |
| ------------------------ | ------------------------------------- |
| `agent.md`               | Agent definition scaffold             |
| `command.md`             | Command definition scaffold           |
| `rule.md`                | Coding rule scaffold                  |
| `skill.md`               | Skill definition scaffold             |
| `plan.md`                | Feature implementation plan           |
| `master_plan.md`         | Parent plan orchestrating child plans |
| `task.md`                | Task tracking template                |
| `prompt.md`              | Custom prompt template                |
| `agents_coordination.md` | Multi-agent coordination reference    |

#### `aidd/memory/` — Memory bank scaffolds

Used by `/init` to generate project context files.

| File                   | Purpose                             |
| ---------------------- | ----------------------------------- |
| `architecture.md`      | Module architecture and structure   |
| `project_brief.md`     | Project vision and domain           |
| `codebase_map.md`      | Project structure documentation     |
| `coding_assertions.md` | Code quality verification checklist |
| `testing.md`           | Testing strategy and guidelines     |
| `deployment.md`        | Infrastructure and deployment       |
| `vcs.md`               | VCS branch naming conventions       |

##### `aidd/memory/internal/` — Internal context scaffolds

Optional templates for domain-specific context. Generated by `/init` when relevant.

| File                       | Purpose                            |
| -------------------------- | ---------------------------------- |
| `api_docs.md`              | API documentation reference        |
| `backend_communication.md` | Backend communication patterns     |
| `browsing.md`              | Browsing and navigation context    |
| `database.md`              | Database schema and conventions    |
| `design.md`                | Design system and UI conventions   |
| `forms.md`                 | Form patterns and validation rules |

#### `dev/` — Development templates

| File             | Purpose                             |
| ---------------- | ----------------------------------- |
| `adr.md`         | Architecture Decision Record        |
| `code_review.md` | Code review checklist and scoring   |
| `decision.md`    | Individual decision record          |
| `tech_choice.md` | Technology selection and comparison |

#### `pm/` — Product management templates

| File                          | Purpose                            |
| ----------------------------- | ---------------------------------- |
| `prd.md`                      | Product Requirements Document      |
| `brief.md`                    | Product brief                      |
| `user_story.md`               | User story with estimation         |
| `persona.md`                  | User persona                       |
| `jtbd.md`                     | Jobs To Be Done                    |
| `milestones.md`               | Deliverable milestones             |
| `interview_transcript.md`     | Stakeholder interview transcript   |
| `discovery_package.md`        | Discovery package                  |
| `gap_report.md`               | Gap analysis report                |
| `implementation_readiness.md` | Implementation readiness checklist |
| `research_report.md`          | Structured research findings       |
| `post-mortem.md`              | Issue tracking with fix plan       |

#### `vcs/` — Version control templates

| File              | Purpose                         |
| ----------------- | ------------------------------- |
| `commit.md`       | Commit message format           |
| `pull_request.md` | Pull/merge request template     |
| `branch.md`       | Branch naming conventions       |
| `issue.md`        | Issue/ticket template           |
| `release.md`      | Release notes template          |
| `README.md`       | Project README scaffold         |
| `CONTRIBUTING.md` | Project contribution guidelines |
