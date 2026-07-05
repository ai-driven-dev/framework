# AI-Driven Dev Docs

This folder is AIDD's memory for *this* project. It holds the context your AI assistant reads before it does any work, so it stays consistent across Claude Code, Cursor, Copilot, Codex, or OpenCode.

New here? Run `aidd-context:00-onboard` - it reads your project and tells you exactly what to do next. The rest of this page is reference material for later.

- [What's in this folder](#whats-in-this-folder)
- [Key terms](#key-terms)
- [The plugins](#the-plugins)
- [How the memory block stays in sync](#how-the-memory-block-stays-in-sync)
- [A typical feature, step by step](#a-typical-feature-step-by-step)
- [Optional: running the loop unattended](#optional-running-the-loop-unattended)
- [Rules for writing a skill](#rules-for-writing-a-skill)
- [References](#references)

---

## What's in this folder

```text
my-project/
├── .claude/                          # Claude Code: skills, agents, rules, hooks
├── .cursor/                          # Cursor: skills, agents, rules
├── .github/copilot-instructions.md   # GitHub Copilot
├── AGENTS.md                         # Cursor, Codex, OpenCode (shared)
├── CLAUDE.md                         # Claude Code
├── aidd_docs/
│   ├── memory/                       # What the AI knows about this project (read every conversation)
│   │   ├── architecture.md
│   │   ├── codebase-map.md
│   │   ├── coding-assertions.md
│   │   ├── deployment.md
│   │   ├── project-brief.md
│   │   ├── testing.md
│   │   ├── vcs.md
│   │   ├── internal/                 #   traces the AI writes about its own work (learn, audits)
│   │   └── external/                 #   docs you point the AI at
│   ├── internal/decisions/           # Decision records (written by aidd-context:10-learn)
│   ├── tasks/                        # Specs, plans, run summaries
│   ├── ADR.md                        # Architecture decision log
│   ├── README.md                     # This file
│   ├── GUIDELINES.md                 # How to work with an AI assistant day to day
│   └── CONTRIBUTING.md               # How to add or change a skill, agent, or rule
├── src/                               # Your application code
└── tests/
```

You will rarely touch anything above except `aidd_docs/memory/`: add or edit a file there when you want the AI to know something new about the project.

## Key terms

One line each. Full definitions: [Glossary](../docs/GLOSSARY.md).

| Term | Where it lives | In one line |
| --- | --- | --- |
| Skill | plugin `skills/` folders | A workflow you trigger by name or by describing what you want |
| Agent | plugin `agents/` folders | A worker a skill dispatches for one isolated sub-task |
| Rule | tool's rules folder | A coding standard the AI applies automatically |
| Hook | plugin `hooks/` folder | Automation that fires on an event (like after a commit) |
| Memory | `aidd_docs/memory/` | Project facts the AI reads every conversation |
| Command | tool's commands folder | A plain slash command with no routing logic. None ship with AIDD today; reserved for your own additions |
| Template | plugin `assets/` folders | The scaffold a generator skill fills in |

## The plugins

Skills are grouped into plugins by topic. Install only what you need.

| Plugin | What it's for | Try this skill first |
| --- | --- | --- |
| `aidd-context` | Set up the project, its memory, and its AI config (skills, agents, rules, diagrams) | `00-onboard` |
| `aidd-refine` | Sharpen a request or double-check prior work | `01-brainstorm` |
| `aidd-pm` | Turn a request into tickets, user stories, a PRD, or a spec | `01-ticket-info` |
| `aidd-dev` | Plan, write, test, review, refactor, and debug code | `01-plan` |
| `aidd-vcs` | Commit, open a PR, tag a release, file an issue | `01-commit` |
| `aidd-orchestrator` | Run the whole loop unattended from a labeled issue (optional) | `00-async-dev` |

See the [full catalog](../docs/CATALOG.md) for every skill and action.

## How the memory block stays in sync

Each AI context file (`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, ...) contains one `<aidd_project_memory>` block. You never edit it by hand:

1. `aidd-context:02-project-memory` creates it the first time.
2. A session-start hook refreshes it automatically, scanning `aidd_docs/memory/` and listing the current files.

To change what the AI sees, add or remove a file under `aidd_docs/memory/` - the hook picks it up next session.

## A typical feature, step by step

Skip what you don't need; loop back as the work demands.

1. **New project?** `aidd-context:01-bootstrap` proposes a stack and architecture, then writes an `INSTALL.md`. Skip this on an existing project.
2. **Set up once** (safe to re-run): `aidd-context:02-project-memory` scaffolds `aidd_docs/` and your AI config files.
3. **Frame the request**: `aidd-refine:01-brainstorm` to clarify it, then `aidd-pm:02-user-stories`, `03-prd`, or `04-spec` to write it down.
4. **Plan**: `aidd-dev:01-plan` turns the request into a phased plan.
5. **Build**: `aidd-dev:02-implement` writes the code; `aidd-dev:03-assert` checks it matches the plan.
6. **Review**: `aidd-dev:05-review` for the diff; `aidd-refine:02-challenge` to stress-test it.
7. **Test**: `aidd-dev:06-test` adds tests and validates the user journey.
8. **Capture learnings**: `aidd-context:09-mermaid` for diagrams, `aidd-context:10-learn` to update memory or rules.
9. **Ship**: `aidd-vcs:01-commit`, then `02-pull-request`; tag with `03-release-tag` once it's live.
10. **Maintain**: `aidd-dev:07-refactor`, `aidd-dev:04-audit`, `aidd-dev:08-debug` as needed.

Want one command for the whole loop instead? Run `aidd-dev:00-sdlc`.

## Optional: running the loop unattended

`aidd-orchestrator` runs the same loop automatically on labeled GitHub issues, on a webhook or a schedule. Most projects don't need this - only add it if you want the AI to pick up `to-implement` issues without anyone pressing a key.

## Rules for writing a skill

Building your own skill? Follow [`CONTRIBUTING.md`](CONTRIBUTING.md). Every skill needs:

- An `## Available actions` table, a `## Default flow`, and `## Transversal rules` in its `SKILL.md`.
- Actions with only `## Inputs`, `## Outputs`, `## Process`, `## Test`.
- Tests that are observable: a command to run, a file to check, or a visible side effect.

## References

[`CONTRIBUTING.md`](CONTRIBUTING.md) covers adding or changing skills, agents, and rules.

External reading:

- Anthropic, Prompt engineering overview: <https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview>
- Anthropic, Claude Code memory: <https://docs.claude.com/en/docs/claude-code/memory>
- OpenAI, Prompt engineering best practices: <https://help.openai.com/en/articles/6654000-best-practices-for-prompting>
- GitHub Docs, Repository custom instructions for Copilot: <https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/adding-repository-custom-instructions-for-github-copilot>
