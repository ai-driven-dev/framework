# Skills catalog

Aggregated index of every skill across the framework. Sourced from each plugin's `SKILL.md` `description` frontmatter; regenerate by running the same logic the lefthook `summarize-plugin-catalogs` step uses, scoped to the framework root.

Generated: 2026-05-15

## aidd-context

Knowledge production plugin for the AI-Driven Development framework.

| Skill | Description |
|-------|-------------|
| [`aidd-context:00:onboard`](../plugins/aidd-context/skills/00-onboard/README.md) | Detect the project's aidd-context state and guide the user to one concrete next aidd-context action through a state -> recommend -> execute loop. Use when the user says "where do I start", "I'm new to this plugin", "onboard me", "what should I run next", "guide me through aidd-context", or invokes `aidd-context:00:onboard`. Do NOT use to enumerate every installed skill from raw user intent (a dedicated discovery skill in this plugin handles that), and do NOT use to teach the global cross-plugin AIDD flow (a separate cross-plugin onboard owns that scope). |
| [`aidd-context:01:bootstrap`](../plugins/aidd-context/skills/01-bootstrap/README.md) | Imagine and validate the technical architecture of a new SaaS through interactive Q&A, candidate-stack comparison, multi-agent audit, and an INSTALL.md output. Use when starting a new SaaS project, choosing a stack, designing the architecture pattern (monolith vs microservices vs serverless), or producing a project's INSTALL.md. Do NOT use for editing an existing project's stack, database schema design, or scaffolding actual files (this skill produces docs only, no code). |
| [`aidd-context:02:project-init`](../plugins/aidd-context/skills/02-project-init/README.md) | Initialize or refresh the project memory bank and ensure AI context files contain the project memory block. Use when running `aidd init` for the first time, bootstrapping a new project, or re-running the init flow on an existing project. Do NOT use for updating individual memory files after they exist - use `aidd-context:05:learn` instead; do NOT use for editing a single rule - edit the file directly. |
| [`aidd-context:03:context-generate`](../plugins/aidd-context/skills/03-context-generate/README.md) | Generate Claude Code context artifacts - skills (router-based: SKILL.md + atomic testable actions + minimal evals), agents, and rules. Use when the user wants to create, refactor, add or remove actions in a skill, migrate a slash command into a skill, or generate a new agent or rule. Do NOT use for editing a single action inside an existing skill (edit directly), creating slash commands (no router needed), writing MCP servers, or modifying project-level CLAUDE.md files. |
| [`aidd-context:04:mermaid`](../plugins/aidd-context/skills/04-mermaid/README.md) | Generate high-quality Mermaid diagrams from markdown content using a structured plan-validate workflow. |
| [`aidd-context:05:learn`](../plugins/aidd-context/skills/05-learn/README.md) | Capture and store project-level learnings, conventions, and decisions surfaced during work into memory, decisions, or rules. Use proactively when the user states a durable project rule or convention ("for next", "always do X", "from now on", "going forward", "rule:", "convention:"), records a technical decision and its rationale, deprecates something, or notes an insight that should outlive the current task. Do NOT use for personal or AI-preference reminders (those belong to user memory), routine code edits, minor fixes, or anything already captured. |
| [`aidd-context:06:discovery`](../plugins/aidd-context/skills/06-discovery/README.md) | Enumerate installed surfaces of the AI tool (skills, agents, commands, plugins, MCP servers, rules, hooks, memory files) and recommend the best match for the user's stated intent. Use proactively whenever the user asks the model to list, show, enumerate, find, or pick among any of these surfaces - including imperative phrasings ("list hooks", "show me the rules", "enumerate skills", "find a memory file", "which agent reviews code"), question phrasings ("what's available?", "what hooks do we have?", "which rule applies here?", "what memory files do we have?"), and indirect phrasings ("what can I use for X?", "do we have something that does Y?"). Always pick this skill over scanning the filesystem with grep, find, ls, or reading action files directly when the user is enumerating a surface. Do NOT use for picking a specific item inside one plugin (the plugin's own onboard handles that), creating a new surface, or executing a recommended item (this skill only points; the user invokes). |

## aidd-dev

Code transformation plugin for the AI-Driven Development framework.

| Skill | Description |
|-------|-------------|
| [`aidd-dev:00:sdlc`](../plugins/aidd-dev/skills/00-sdlc/README.md) | Pure orchestrator for the full AIDD development flow. Use when a human (or Gardener) needs to take a free-form request from idea to shipped code, end-to-end. Coordinates spec generation, planning, implementation, review, and shipping by composing other skills and agents. Supports two modes - `auto` (default, no human interaction) and `interactive` (pauses for human confirmation at key gates). Holds no business logic of its own; every step is delegated. |
| [`aidd-dev:01:plan`](../plugins/aidd-dev/skills/01-plan/README.md) | Generate technical implementation plans, define component behaviors, and extract design details from images. |
| [`aidd-dev:02:implement`](../plugins/aidd-dev/skills/02-implement/README.md) | Execute an implementation plan phase by phase via the implementer agent, iterating until 100% completeness. |
| [`aidd-dev:03:assert`](../plugins/aidd-dev/skills/03-assert/README.md) | Assert features work as intended - general assertions, architecture conformance, and frontend UI validation. |
| [`aidd-dev:04:audit`](../plugins/aidd-dev/skills/04-audit/README.md) | Perform deep codebase analysis to identify technical debt, dead code, and improvement opportunities. |
| [`aidd-dev:05:review`](../plugins/aidd-dev/skills/05-review/README.md) | Review code quality against project rules and validate feature behavior against plan specifications. |
| [`aidd-dev:06:test`](../plugins/aidd-dev/skills/06-test/README.md) | Write and iterate on tests until they pass, and validate user journeys end-to-end in the browser. |
| [`aidd-dev:07:refactor`](../plugins/aidd-dev/skills/07-refactor/README.md) | Optimize code for performance and fix security vulnerabilities following OWASP guidelines. |
| [`aidd-dev:08:debug`](../plugins/aidd-dev/skills/08-debug/README.md) | Reproduce and fix bugs systematically using test-driven workflow, root cause analysis, and hypothesis validation. |
| [`aidd-dev:09:for-sure`](../plugins/aidd-dev/skills/09-for-sure/README.md) | Iterative agent loop that tracks attempts and retries until a success condition is met. Use when the user says "for sure", "make sure", "keep trying until", "loop until done", "don't stop until", or needs guaranteed completion of a task with explicit success criteria. |

## aidd-vcs

VCS workflow plugin for the AI-Driven Development framework.

| Skill | Description |
|-------|-------------|
| [`aidd-vcs:01:commit`](../plugins/aidd-vcs/skills/01-commit/README.md) | Create an atomic git commit with conventional message format. Use when the user says "commit", "git commit", "create a commit", "commit my changes", "commit and push", or invokes `/aidd-vcs:01:commit`. Do NOT use for amending existing commits, force-pushing, rebasing, opening pull requests, or release tagging. |
| [`aidd-vcs:02:pull-request`](../plugins/aidd-vcs/skills/02-pull-request/README.md) | Create a draft pull or merge request from the current branch. Use when the user says "open a pr", "open a pull request", "create a pr", "create a merge request", "open mr", "draft a pr for this branch", or invokes `/pull-request`. Do NOT use for committing changes, pushing a branch directly, tagging releases, merging an existing request, or amending commits. |
| [`aidd-vcs:03:release-tag`](../plugins/aidd-vcs/skills/03-release-tag/README.md) | Cut a semver release with annotated tag and release notes. Use when the user says "release", "tag", "tag this release", "bump version", "release v1.2.0", "cut a release", or invokes `/release-tag`. Do NOT use for plain commits without a tag, opening pull requests, pushing a branch only, or amending existing tags. |
| [`aidd-vcs:04:issue-create`](../plugins/aidd-vcs/skills/04-issue-create/README.md) | Create an issue in the configured ticketing tool. Use when the user says "new issue", "create an issue", "file a bug", "file an issue", "report bug", "open an issue", or invokes `/issue-create`. Do NOT use for committing changes, opening pull requests, tagging releases, or commenting on existing issues. |

## aidd-pm

Product management plugin for the AI-Driven Development framework.

| Skill | Description |
|-------|-------------|
| [`aidd-pm:01:ticket-info`](../plugins/aidd-pm/skills/01-ticket-info/README.md) | Retrieve and display ticket information from the configured ticketing tool. Use when the user says "ticket info", "show ticket", "get ticket", "ticket details", "what's <id>", or invokes `/ticket-info`. Do NOT use for creating issues, commenting on tickets, changing status, or reassigning. |
| [`aidd-pm:02:user-stories-create`](../plugins/aidd-pm/skills/02-user-stories-create/README.md) | Generate INVEST-compliant user stories from a feature description. Use when the user says "user stories", "create user stories", "write user stories for X", "INVEST stories", "draft stories", or invokes `/user-stories-create`. Do NOT use for writing code, drafting a full PRD, refining a single existing story, or copying ready text into a tracker. |
| [`aidd-pm:03:prd`](../plugins/aidd-pm/skills/03-prd/README.md) | Generate a structured Product Requirements Document from a feature description or user stories, validated with the user before save. Use when the user says "prd", "draft prd", "write prd", "product requirements for X", "generate a prd", or invokes `/prd`. Do NOT use for writing user stories, drafting a technical implementation plan, or writing source code. |
| [`aidd-pm:04:spec`](../plugins/aidd-pm/skills/04-spec/README.md) | Generate or refine a project spec from a free-form human request, an existing PRD, or reviewer findings. Use when the user says "draft spec", "spec for X", "refine the spec", "generate spec from prd", "/spec", or when an orchestrator needs a normalized contract before planning. Do NOT use for writing source code, drafting a full PRD, or modifying a validated and locked spec. |

## aidd-orchestrator

Orchestration plugin for the AI-Driven Development framework.

| Skill | Description |
|-------|-------------|
| [`aidd-orchestrator:00:async-dev`](../plugins/aidd-orchestrator/skills/00-async-dev/README.md) | Single router-based skill covering the full async-dev pipeline (setup, run, review). Picks the sub-flow from `$ARGUMENTS` keyword (`setup` / `run` / `review`), trigger source (label `to-implement` / `to-review`, comment `@claude /implement` / `/review`), repo state (workflow + config presence, PR linked), or natural-language intent. Use when the user wants to install async-dev, implement a ready issue, address review comments on a PR, or for any webhook-triggered run. Do NOT use for plain status checks or for SDLC orchestration unrelated to issue/PR automation. |

## aidd-refine

Meta-cognition plugin for the AI-Driven Development framework.

| Skill | Description |
|-------|-------------|
| [`aidd-refine:01:brainstorm`](../plugins/aidd-refine/skills/01-brainstorm/README.md) | Interactive brainstorming session to clarify and refine requests through iterative questioning. Use when user mentions unclear requirements, vague ideas, or needs clarification on features. Do NOT use for clear technical specs, implementation details, or when requirements are already well-defined. |
| [`aidd-refine:02:challenge`](../plugins/aidd-refine/skills/02-challenge/README.md) | Rethink prior work to verify correctness against an agreed plan, classifying findings as deal-breakers, suggestions, or correct, with a confidence score. Use when the user says "challenge this", "rethink your plan", "is this correct", "review my last decision", "challenge my decision", "challenge what you did", "is my decision right", "criticize this", "find flaws", or asks for a critical review of just-completed work. Do NOT use for line-by-line code review against a style guide, implementing features, writing tests, or generating new code. |
| [`aidd-refine:03:condense`](../plugins/aidd-refine/skills/03-condense/README.md) | Toggle terse output mode with intensity levels (lite, full, ultra) so prose drops articles, filler, and pleasantries while code, quoted errors, and security warnings stay verbatim. Also reports real token usage and estimated savings under condense mode for the current session. Use when the user says "condense", "condense output", "be more concise", "shorter answers", "tighten output", "/condense", "/condense full", "/condense ultra", "stop condense", "normal mode", "/condense-stats", "how much have we saved", or "token savings". Do NOT use for editing existing prose, summarizing a long document, or compressing source code (only output style is affected, not content). |

## See also

- [`../README.md`](../README.md) - marketplace landing and per-plugin links.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) - composition model and skill router pattern.
- [`GLOSSARY.md`](GLOSSARY.md) - terminology reference.
- [`CREATE_PLUGIN.md`](CREATE_PLUGIN.md) - add your own plugin.
