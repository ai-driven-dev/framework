# 🤖 AI-Driven Dev Framework (AIDD)

> Construisez vite. Livrez sereinement.

- Release : 2024-06-15
- Version : 3.0.0
- Site : <https://www.ai-driven-dev.com>

## 📁 Structure

Ce framework est **indépendant de l'outil** (`tool-agnostic`). Tout le contenu (agents, commandes, templates, règles, skills, mémoire) vit dans des dossiers plats sans syntaxe spécifique à un IDE.

Le CLI se charge de l'installation dans un projet et génère des copies adaptées à chaque outil.

| Dossier      | Description                                         |
| ------------ | --------------------------------------------------- |
| `agents/`    | Définitions des agents IA                           |
| `commands/`  | Commandes SDLC organisées par phase                 |
| `config/`    | Fichiers de configuration (mcp.json, .vscode)       |
| `rules/`     | Règles de codage par catégorie                      |
| `skills/`    | Définitions de skills réutilisables                 |
| `templates/` | Modèles de documents (aidd, dev, pm, vcs)           |

### Structure d'un projet installé

Une fois installé via le CLI, le projet contient :

```text
project/
├── .aidd/              # Config + état (régénérable)
│   └── config.yml
├── aidd_docs/          # Documentation (templates, mémoire, tâches)
│   ├── templates/
│   ├── memory/         # Généré par /init (spécifique au projet)
│   └── tasks/          # Plans d'implémentation et suivi
├── .claude/            # Copies pour Claude Code (générées par le CLI)
├── .cursor/            # Copies pour Cursor (générées par le CLI)
├── .github/            # Copies pour GitHub Copilot (générées par le CLI)
├── CLAUDE.md / AGENTS.md  # Template mémoire projet
└── .mcp.json           # Configuration MCP (optionnel)
```

### Fichiers racine

| Fichier                   | Description                          |
| ------------------------- | ------------------------------------ |
| `CLAUDE.md`               | Mémoire projet (Claude Code)        |
| `AGENTS.md`               | Mémoire projet (Cursor)             |
| `copilot.instructions.md` | Mémoire projet (GitHub Copilot)     |
| `config.yml`              | Version et configuration du framework |
| `CONTRIBUTING.md`         | Guide de contribution                |

## 📦 Installation

### Option A : AIDD CLI (recommandé)

Utilisez le CLI pour une installation et des mises à jour automatisées.

- CLI : <https://github.com/ai-driven-dev/aidd/tree/main/cli>

### Option B : Zip pré-construit par outil

Chaque outil supporté dispose d'un zip prêt à extraire à la racine de votre projet. Aucune transformation nécessaire — les fichiers sont déjà adaptés au format natif de l'outil.

| Outil          | Contenu du zip                                                    |
| -------------- | ----------------------------------------------------------------- |
| GitHub Copilot | `.github/` (agents, prompts, instructions, skills) + `aidd_docs/` |
| Claude Code    | `.claude/` (agents, commands, rules, skills) + `aidd_docs/`       |
| Cursor         | `.cursor/` (agents, commands, rules, skills) + `aidd_docs/`       |

Chaque zip inclut aussi `.aidd/config.yml`, le fichier mémoire (`CLAUDE.md` ou `AGENTS.md` ou `copilot.instructions.md`) et la configuration MCP.

## 🔄 Flow Map du Framework

| Étape   | Prompt(s)                             | Quand l'utiliser                     |
| ------- | ------------------------------------- | ------------------------------------ |
| Init    | `/init`                               | Démarrer une session, charger le contexte |
| Plan    | `/plan` ou `/elaborate`               | Construire le plan technique         |
| Build   | `/implements`                         | Implémenter le plan                  |
| Verify  | `/assert`                             | Vérifier, corriger et itérer         |
| Review  | `/review_code` + `/review_functional` | Revoir la qualité et le comportement |
| Commit  | `/commit`                             | Commiter les changements             |
| PR      | `/create_request`                     | Ouvrir une pull request              |
| Learn   | `/learn`                              | Mettre à jour mémoire et règles      |

## 👌 Contribuer

Pour ajouter ou modifier des agents, commandes, règles ou skills, voir le [guide de contribution](./CONTRIBUTING.md).

← [Retour au repo principal](../README.md)

<!-- AIDD-SUMMARY-START -->

## Prompts Documentation

This document provides an overview of all prompts organized by category.

### `agents`

| Group | File | Description | Color | Model | Https |
|-------|------|---|---|---|---|
| `-` | [alexia.md](agents/alexia.md) | `Autonomous end-to-end feature implementation wi...` | `purple` | `opus` | - |
| `-` | [claire.md](agents/claire.md) | `Product discovery agent — from fuzzy idea to Pr...` | `blue` | - | - |
| `-` | [iris.md](agents/iris.md) | `Frontend specialist with 3 modes - implement fr...` | `blue` | `haiku` | - |
| `-` | [kent.md](agents/kent.md) | `Use this agent when explicitly asked to perform...` | - | - | `//tidyfirst.substack.com/p/augmented-coding-bey...` |
| `-` | [martin.md](agents/martin.md) | `Every time you need to run a command to ensure ...` | - | - | - |
| `-` | [roman.md](agents/roman.md) | `Backlog generation agent — from validated PRD t...` | `green` | - | - |

### `commands`

#### `commands/01_onboard`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `-` | [generate_agent.md](commands/01_onboard/generate_agent.md) | `Generates a customized agent based on user-defi...` | - |
| `-` | [generate_command.md](commands/01_onboard/generate_command.md) | `Generate optimized, action-oriented prompts usi...` | `The command details to generate the prompt for` |
| `-` | [generate_rules.md](commands/01_onboard/generate_rules.md) | `Generate or modify coding rules for the project...` | - |
| `-` | [generate_skill.md](commands/01_onboard/generate_skill.md) | `Generate a customized skill based on repeated p...` | `Description of the workflow to package as a skill` |
| `-` | [improve_prompt.md](commands/01_onboard/improve_prompt.md) | `Verify and improve existing prompts against bes...` | `Path to the prompt file to improve` |
| `-` | [init.md](commands/01_onboard/init.md) | `Create or update the memory bank files to refle...` | - |

#### `commands/02_context`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `-` | [analyze_raw_data.md](commands/02_context/analyze_raw_data.md) | `Extract insights with triangulation` | `transcripts, notes, feedback files` |
| `-` | [brainstorm_features.md](commands/02_context/brainstorm_features.md) | `Generate 5-7 feature ideas from Brief + Researc...` | `BRIEF.md + RESEARCH_REPORT.md` |
| `-` | [brainstorm.md](commands/02_context/brainstorm.md) | `Create an interactive brainstorming session to ...` | - |
| `-` | [challenge.md](commands/02_context/challenge.md) | `Rethink and challenge previous work for improve...` | - |
| `-` | [create_user_stories.md](commands/02_context/create_user_stories.md) | `Create user stories through iterative questioning` | `Feature description or requirements for user st...` |
| `-` | [document_prototype.md](commands/02_context/document_prototype.md) | `Generate PRD from validated prototype through r...` | `'prototype code or path'` |
| `-` | [extract_brief.md](commands/02_context/extract_brief.md) | `Extract light Brief from brain dump - strategic...` | `brain_dump.md` |
| `-` | [extract_insights.md](commands/02_context/extract_insights.md) | `Extract user insights, personas, and JTBD from ...` | `sources/ folder OR specific files (interviews, ...` |
| `-` | [extract_milestones.md](commands/02_context/extract_milestones.md) | `Split PRD into deliverable milestones with comp...` | `PRD content or file path` |
| `-` | [gap_analysis.md](commands/02_context/gap_analysis.md) | `Analyze specs for edge cases, gaps, inconsisten...` | `<prd-path> or paste specs inline` |
| `-` | [generate_backlog_initial.md](commands/02_context/generate_backlog_initial.md) | `Generate initial product backlog (Epics + User ...` | `PRD file path or use default {{DOCS}}/internal/...` |
| `-` | [generate_empathy.md](commands/02_context/generate_empathy.md) | `Generate empathy maps from insights` | `(uses previous insights)` |
| `-` | [generate_jtbd.md](commands/02_context/generate_jtbd.md) | `Formulate JTBD from personas` | `(uses previous personas)` |
| `-` | [generate_personas.md](commands/02_context/generate_personas.md) | `Create detailed user personas with 3 variations...` | `[product/audience] OR (uses previous empathy maps)` |
| `-` | [generate_prd.md](commands/02_context/generate_prd.md) | `Generate or update a PRD from a feature idea th...` | `new <feature>" or "update <prd-path> <changes>` |
| `-` | [interview.md](commands/02_context/interview.md) | `Interview the PM or simulate a persona interview` | `topic/idea to explore` |
| `-` | [market_research.md](commands/02_context/market_research.md) | `Structure raw market research into validated RE...` | `pasted research report OR file path to research` |
| `-` | [prepare_proto.md](commands/02_context/prepare_proto.md) | `Generate structured prompts for AI prototyping ...` | `brainstorm output or feature brief` |
| `-` | [prioritize_backlog.md](commands/02_context/prioritize_backlog.md) | `Prioritize (MoSCoW) and estimate (Fibonacci) us...` | `USER_STORIES file path or use default {{DOCS}}/...` |
| `-` | [refine_user_stories.md](commands/02_context/refine_user_stories.md) | `Refine user stories with Gherkin acceptance cri...` | `USER_STORIES file path or use default {{DOCS}}/...` |

#### `commands/03_plan`

| Group | File | Description | Argument Hints | Argument Hint |
|-------|------|---|---|---|
| `-` | [components_behavior.md](commands/03_plan/components_behavior.md) | `Define the expected behavior of frontend compon...` | `names of the components to define behavior for.` | - |
| `-` | [image_extract_details.md](commands/03_plan/image_extract_details.md) | `Analyze image to identify and extract main comp...` | - | `the image to analyze` |
| `-` | [implementation_readiness.md](commands/03_plan/implementation_readiness.md) | `Validate that specification is complete and rea...` | - | `<path-to-prd> or use current docs/product/` |
| `-` | [plan.md](commands/03_plan/plan.md) | `Generate technical implementation plans from re...` | - | `requirements (GitHub issue URL or raw text)` |

#### `commands/04_code`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `-` | [assert_frontend.md](commands/04_code/assert_frontend.md) | `Assert a frontend feature works as intended.` | `The frontend behavior you need to assert and va...` |
| `-` | [assert.md](commands/04_code/assert.md) | `Assert that a feature must work as intended.` | - |
| `-` | [implement_from_design.md](commands/04_code/implement_from_design.md) | `Implement a frontend component from a Figma des...` | `The Figma file URL and frame/component to imple...` |
| `-` | [implement.md](commands/04_code/implement.md) | `Implement plan following project rules with val...` | `The technical plan to implement` |
| `-` | [isolate.md](commands/04_code/isolate.md) | `Create an isolated worktree automatically for m...` | `Optional context or branch name hint` |
| `-` | [run_projection.md](commands/04_code/run_projection.md) | `Project the solution you mentioned on a part of...` | - |

#### `commands/05_review`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `-` | [review_code.md](commands/05_review/review_code.md) | `Ensure code quality and rules compliance` | - |
| `-` | [review_functional.md](commands/05_review/review_functional.md) | `Use this agent when you need to browse current ...` | `The technical plan to base the review on` |

#### `commands/06_tests`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `-` | [list_untested.md](commands/06_tests/list_untested.md) | `List all untested behaviors in codebase` | - |
| `-` | [test_journey.md](commands/06_tests/test_journey.md) | `Test a user journey end-to-end by navigating an...` | `The user journey steps to validate and the URL ...` |
| `-` | [write.md](commands/06_tests/write.md) | `Iterate on test creation and improvement until ...` | - |

#### `commands/07_documentation`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `-` | [jira_info.md](commands/07_documentation/jira_info.md) | `Get JIRA ticket info from current branch` | `Jira URL or number` |
| `-` | [learn.md](commands/07_documentation/learn.md) | `Update memory bank or rules with new informatio...` | - |
| `-` | [mermaid.md](commands/07_documentation/mermaid.md) | `When need to generate Mermaid diagrams` | - |

#### `commands/08_deploy`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `-` | [commit.md](commands/08_deploy/commit.md) | `Create git commit with proper message format` | `auto` |
| `-` | [create_request.md](commands/08_deploy/create_request.md) | `Create PR (GitHub) or MR (GitLab) with filled t...` | - |
| `-` | [tag.md](commands/08_deploy/tag.md) | `Create and push git tag with semantic versioning` | - |

#### `commands/09_refactor`

| Group | File | Description |
|-------|------|---|
| `-` | [performance.md](commands/09_refactor/performance.md) | `Optimize code for better performance` |
| `-` | [security_refactor.md](commands/09_refactor/security_refactor.md) | `Identify and fix security vulnerabilities` |

#### `commands/10_maintenance`

| Group | File | Description | Argument Hint | Allowed Tools |   Https |
|-------|------|---|---|---|---|
| `-` | [codebase_audit.md](commands/10_maintenance/codebase_audit.md) | `Perform deep codebase analysis for technical de...` | `Scope to audit (optional - defaults to full cod...` | - | - |
| `-` | [debug.md](commands/10_maintenance/debug.md) | `Debug issue to find root cause.` | - | - | - |
| `-` | [new_issue.md](commands/10_maintenance/new_issue.md) | `Create GitHub issues with interactive template ...` | `Describe the problem you want to create an issu...` | `Bash(date), gh` | `//github.com/steipete/agent-rules/blob/main/glo...` |
| `-` | [reflect_issue.md](commands/10_maintenance/reflect_issue.md) | `Reflect on possible sources, identify most like...` | - | - | - |
| `-` | [reproduce.md](commands/10_maintenance/reproduce.md) | `Fix bugs with test-driven workflow from issue t...` | `Bug description or issue number` | - | - |

### `config`

No files found.
### `rules`

#### `rules/01-standards`

| Group | File | Description | Globs | AlwaysApply |
|-------|------|---|---|---|
| `-` | [1-mermaid.md](rules/01-standards/1-mermaid.md) | `Rules for generating valid, high-quality Mermai...` | `["**/*.mmd"]` | `false` |
| `-` | [1-rule-structure.md](rules/01-standards/1-rule-structure.md) | `Standards for naming and organizing .md rule fi...` | `["{{TOOLS}}/rules/**/*.md", "{{TOOLS}}/rules/**...` | `false` |
| `-` | [1-rule-writing.md](rules/01-standards/1-rule-writing.md) | `Standards for writing .md coding rule content. ...` | `["{{TOOLS}}/rules/**/*.md", "{{TOOLS}}/rules/**...` | `false` |

#### `rules/04-tooling`

| Group | File | ApplyTo | Description | Globs |
|-------|------|---|---|---|
| `-` | [ide-mapping.claude.md](rules/04-tooling/ide-mapping.claude.md) | - | - | - |
| `-` | [ide-mapping.copilot.md](rules/04-tooling/ide-mapping.copilot.md) | `{{TOOLS}}/rules/**/*.md,{{TOOLS}}/rules/**/*.mdc` | - | - |
| `-` | [ide-mapping.cursor.md](rules/04-tooling/ide-mapping.cursor.md) | - | `Cursor file locations, syntax and frontmatter r...` | `["{{TOOLS}}/rules/**/*.md", "{{TOOLS}}/rules/**...` |

### `skills`

#### `skills/aidd-auto-implement`

| Group | File | Description | Argument Hints |
|-------|------|---|---|
| `-` | [SKILL.md](skills/aidd-auto-implement/SKILL.md) | `Autonomously run the AI-Driven Development work...` | `The URL or file path of the issue or task to im...` |

### `templates`

| Group | File | Description |
|-------|------|---|
| `-` | [AGENTS.md](templates/AGENTS.md) | `AI agent configuration and guidelines` |

#### `templates/aidd`

| Group | File | Description | Color | Model | Argument Hint | Scope | Globs |
|-------|------|---|---|---|---|---|---|
| `-` | [agent.md](templates/aidd/agent.md) | `<when-this-agent-needs-to-be-called>` | `<inferred-color-based-on-description>` | `<model>` | - | - | - |
| `-` | [agents_coordination.md](templates/aidd/agents_coordination.md) | `Multi-agent coordination and workflows template` | - | - | - | - | - |
| `-` | [command.md](templates/aidd/command.md) | `<generated-action-oriented-description>` | - | - | `<generated-argument-hint-if-applicable>` | - | - |
| `-` | [master_plan.md](templates/aidd/master_plan.md) | `Parent plan template orchestrating multiple chi...` | - | - | - | - | - |
| `memory` | [architecture.md](templates/aidd/memory/architecture.md) | `Module architecture and structure` | - | - | - | `all` | - |
| `memory` | [codebase_map.md](templates/aidd/memory/codebase_map.md) | `Project structure documentation` | - | - | - | `all` | - |
| `memory` | [coding_assertions.md](templates/aidd/memory/coding_assertions.md) | `Code quality verification checklist` | - | - | - | `all` | - |
| `memory` | [deployment.md](templates/aidd/memory/deployment.md) | `Infrastructure and deployment documentation` | - | - | - | `all` | - |
| `memory` | [project_brief.md](templates/aidd/memory/project_brief.md) | `Project vision and domain documentation` | - | - | - | `all` | - |
| `memory` | [testing.md](templates/aidd/memory/testing.md) | `Testing strategy and guidelines` | - | - | - | `all` | - |
| `memory` | [vcs.md](templates/aidd/memory/vcs.md) | `VCS branch naming convention template` | - | - | - | `all` | - |
| `-` | [plan.md](templates/aidd/plan.md) | `Feature implementation plan template` | - | - | - | - | - |
| `-` | [prompt.md](templates/aidd/prompt.md) | `Custom prompt template example` | - | - | - | - | - |
| `-` | [review_code.md](templates/aidd/review_code.md) | - | - | - | - | - | - |
| `-` | [rule.md](templates/aidd/rule.md) | `< One line. Comprehensive description that prov...` | - | - | - | - | `<Appropriate extension language based on langua...` |
| `-` | [skill.md](templates/aidd/skill.md) | `<What it does - actions, capabilities>. Use whe...` | - | - | - | - | - |
| `-` | [task.md](templates/aidd/task.md) | `Task tracking system to ensure all tasks are ca...` | - | - | - | - | - |

#### `templates/dev`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `-` | [adr.md](templates/dev/adr.md) | `Architecture Decision Record template` | - |
| `-` | [code_review.md](templates/dev/code_review.md) | `Code review checklist and scoring template` | - |
| `-` | [decision.md](templates/dev/decision.md) | `Individual decision record template` | `<title>` |
| `-` | [tech_choice.md](templates/dev/tech_choice.md) | `Technology selection and comparison template` | - |

#### `templates/docs`

| Group | File |
|-------|------|
| `-` | [CONTRIBUTING.md](templates/docs/CONTRIBUTING.md) |
| `-` | [README.md](templates/docs/README.md) |

#### `templates/pm`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `-` | [brief.md](templates/pm/brief.md) | - | - |
| `-` | [discovery_package.md](templates/pm/discovery_package.md) | - | - |
| `-` | [gap_report.md](templates/pm/gap_report.md) | `Template for gap analysis report` | - |
| `-` | [implementation_readiness.md](templates/pm/implementation_readiness.md) | `Template for implementation readiness checklist...` | - |
| `-` | [interview_transcript.md](templates/pm/interview_transcript.md) | - | - |
| `-` | [jtbd.md](templates/pm/jtbd.md) | - | - |
| `-` | [milestones.md](templates/pm/milestones.md) | `Template for deliverable milestones with go/no-...` | - |
| `-` | [persona.md](templates/pm/persona.md) | - | - |
| `-` | [post-mortem.md](templates/pm/post-mortem.md) | `Issue tracking template with fix plan` | - |
| `-` | [prd.md](templates/pm/prd.md) | `Product Requirements Document template (15 sect...` | - |
| `-` | [research_report.md](templates/pm/research_report.md) | `Template for structured research findings` | - |
| `-` | [user_story.md](templates/pm/user_story.md) | `Template for defining user stories with estimat...` | - |

#### `templates/vcs`

| Group | File | Description | Argument Hint |
|-------|------|---|---|
| `-` | [branch.md](templates/vcs/branch.md) | `VCS branch naming convention template` | - |
| `-` | [commit.md](templates/vcs/commit.md) | `VCS commit message template` | - |
| `-` | [CONTRIBUTING.md](templates/vcs/CONTRIBUTING.md) | `Project contribution guidelines template` | - |
| `-` | [issue.md](templates/vcs/issue.md) | `VCS issue/ticket template` | - |
| `-` | [pull_request.md](templates/vcs/pull_request.md) | `VCS pull/merge request template` | - |
| `-` | [README.md](templates/vcs/README.md) | `Project README template` | - |
| `-` | [release.md](templates/vcs/release.md) | `VCS release notes template` | - |

<!-- AIDD-SUMMARY-END -->
