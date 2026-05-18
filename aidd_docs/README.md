# AI-Driven Dev Docs

AIDD structures your AI coding assistant with skills, agents, rules, and a memory bank so it produces consistent, high-quality work. This guide takes you from setup to autonomous workflows in a progressive path.

- [AI-Driven Dev Docs](#ai-driven-dev-docs)
  - [What You Get](#what-you-get)
    - [Concepts](#concepts)
    - [Framework Structure](#framework-structure)
  - [Phase 1: Setup and Initialization](#phase-1-setup-and-initialization)
  - [Phase 2: Configure Your Project](#phase-2-configure-your-project)
  - [Phase 3: Minimal Flow](#phase-3-minimal-flow)
  - [Phase 4: Standard Flow](#phase-4-standard-flow)
  - [Phase 5: Full Flow](#phase-5-full-flow)
  - [Phase 6: Maintenance and Evolution](#phase-6-maintenance-and-evolution)
  - [Validation Rules](#validation-rules)
  - [References](#references)

---

## What You Get

When you install AIDD, your project gets a ready-to-use framework: a plugin marketplace of skills, agents, rules, templates, and a memory system, all pre-configured. You invoke skills via slash commands and the AI follows structured workflows instead of guessing.

The framework is built to be scalable, standardized, and customizable across any project. Every skill, agent, and rule is derived from templates you can adapt.

### Concepts

| Block       | Location                                       | What it does                                                |
| ----------- | ---------------------------------------------- | ----------------------------------------------------------- |
| Memory      | `aidd_docs/memory/`                            | Project context the AI reads on every conversation          |
| Skills      | plugin `skills/` folders                       | Router-based workflows triggered by user phrases or slashes |
| Agents      | plugin `agents/` folders                       | Specialized AI personas for focused tasks                   |
| Rules       | tool-specific rules dir (see your AI tool docs) | Coding standards the AI follows automatically              |
| Templates   | plugin `assets/` folders                       | Scaffolding for new skills, rules, agents                   |
| Memory bank | `aidd_docs/memory/`                            | Architecture, codebase map, decisions, testing, vcs        |

> See [CATALOG.md](../docs/CATALOG.md) for the exhaustive list of plugins and skills.

### Framework Structure

Each plugin owns a clear domain:

| Plugin            | Domain                                                                            |
| ----------------- | --------------------------------------------------------------------------------- |
| aidd-context      | Knowledge production: bootstrap, init, context generation, mermaid, learn, discover |
| aidd-refine       | Meta-cognition: brainstorm, challenge, condense                                   |
| aidd-pm           | Product management: ticket info, user stories, PRD, spec                          |
| aidd-dev          | Code transformation: dev SDLC, plan, assert, review, test, refactor, debug        |
| aidd-vcs          | VCS workflows: commit, pull/merge request, release tag, issue                     |
| aidd-orchestrator | Async orchestration: turn ready issues into PRs and iterate on review             |

---

## Phase 1: Setup and Initialization

Install the framework once, then bootstrap each project you want to use it on. AIDD ships for multiple AI tools (Claude Code, Cursor, Copilot, Codex, OpenCode); install with whichever tool's plugin manager you use.

1. Install the AIDD marketplace via your AI tool's plugin manager (each tool has its own command).
2. Run `aidd-context:02:project-init` on a new repo. It scaffolds `aidd_docs/`, the AI context file appropriate to your tool, and the memory bank. The skill asks which AI tools you actively use, so files for unused tools are not created.
3. Confirm the detected project type (frontend, backend, or both).

---

## Phase 2: Configure Your Project

Tailor the rules and memory to your project.

- Edit files under `aidd_docs/memory/` (shared across every AI tool that supports memory loading).
- Add or refine rules under your AI tool's rules directory (path differs per tool: see the tool's docs).
- Drop project-specific guidelines into `aidd_docs/GUIDELINES.md`.
- The `<aidd_project_memory>` block inside the AI context file (`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, etc.) is kept in sync by `aidd-context:02:project-init` across whichever tools you opted into.

---

## Phase 3: Minimal Flow

The 4-skill loop for simple changes:

1. `aidd-refine:01:brainstorm` clarifies the request.
2. `aidd-dev:01:plan` produces a short plan.
3. Implement.
4. `aidd-vcs:01:commit` to commit.

---

## Phase 4: Standard Flow

Add review and tests:

1. brainstorm
2. plan
3. implement
4. `aidd-dev:05:test` to add or run tests
5. `aidd-dev:04:review` to check code quality and behavior
6. commit
7. `aidd-vcs:02:pull-request` to open a draft request

---

## Phase 5: Full Flow

Use the orchestrator for end-to-end runs:

- `aidd-dev:00:sdlc` drives the full pipeline: spec, plan, implementation, finalize. It adapts entry to whichever artifacts already exist.
- `aidd-orchestrator:00:async-dev` (with `action=run`) handles async runs that turn ready issues into PRs.

---

## Phase 6: Maintenance and Evolution

- Fix a bug: `aidd-dev:07:debug`.
- Audit: `aidd-dev:03:audit`.
- Refactor: `aidd-dev:06:refactor`.
- Validate architecture: `aidd-dev:02:assert`.
- Capture learnings: `aidd-context:05:learn`.

---

## Validation Rules

- Skills must have an `## Available actions` table, `## Default flow`, `## Transversal rules`.
- Actions must contain only `## Inputs`, `## Outputs`, `## Process`, `## Test`.
- Tests must be observable: command, artifact check, or side effect.
- Evals (`evals/scenarios.json`) ship for every auto-trigger skill.

---

## References

See [CONTRIBUTING.md](CONTRIBUTING.md) for adding or modifying plugins and skills.

External:

- Anthropic, Prompt engineering overview: <https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview>
- Anthropic, Claude Code memory: <https://docs.claude.com/en/docs/claude-code/memory>
