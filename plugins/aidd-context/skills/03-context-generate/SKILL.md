---
name: aidd-context:03:context-generate
description: Generate Claude Code context artifacts - skills (router-based: SKILL.md + atomic testable actions + minimal evals), agents, and rules. Use when the user wants to create, refactor, add or remove actions in a skill, migrate a slash command into a skill, or generate a new agent or rule. Do NOT use for editing a single action inside an existing skill (edit directly), creating slash commands (no router needed), writing MCP servers, or modifying project-level CLAUDE.md files.
---

# Context Generate

Generates the three context artifacts a project consumes:

- **Skills** - router-based: `SKILL.md` router + atomic testable actions, evaluations declared before implementation.
- **Agents** - single-file agent definitions following the framework's agent template.
- **Rules** - framework rule files that govern editor/agent behavior.

## Skill-generation actions

| #   | Action              | Role                                          | Input              |
| --- | ------------------- | --------------------------------------------- | ------------------ |
| 01  | `capture-intent`    | Clarify output + decide generate vs modify    | user intent        |
| 02  | `design-evals`      | Write minimal `scenarios.json`                | expected output    |
| 03  | `decompose-actions` | List actions + their tests                    | evals + output     |
| 04  | `draft-skill`       | Write SKILL.md router                         | decomposed actions |
| 05  | `write-actions`     | Write each action file                        | validated SKILL.md |
| 06  | `validate`          | Spawn one agent per action, run its `## Test`, aggregate into a pass/fail report | complete skill |

Files: `actions/skills/01-capture-intent.md` … `actions/skills/06-validate.md`.

## Other generation actions

- `actions/agents/01-generate-agent.md` - generate a project agent file from `assets/agents/agent-template.md`.
- `actions/rules/01-generate-rules.md` - generate framework rules from `assets/rules/rule-template.md`.

## Default skill flow

`01 → 02 → 03 → 04 → 05 → 06`. After each action, run its `## Test` before moving to the next. Action 02 self-skips when `01` outputs `invocation_mode = manual`.

## Modify flow

`01` (detects modify) → `03` (re-decompose if structure changes) → `05` (targeted edit) → `06` (re-validate).

## Runtime tracking

Materialize the flow as a task list at skill entry; a task closes only when its `## Test` passes.

## Rules

- **R1** - SKILL.md is a pure router: description + action table + transversal rules. Zero business logic.
- **R2** - One skill = one domain (tool OR activity). Tool → singular noun (`slack`); activity → action verb (`review`). See `references/naming-conventions.md`.
- **R3** - References one-level deep. Never chain reference → reference.
- **R4** - SKILL.md ≤ 500 lines. If exceeded, split into references.
- **R5** - Description must include: what, explicit triggers, "Do NOT use for..." clause.
- **R6** - Zero duplication. Templates live in `assets/`; actions point to them via `@<path>`.
- **R7** - `references/` = documents to READ (conventions, cheatsheets). `assets/` = files to COPY or INJECT (templates, ID tables).
- **R8** - Every action has a `## Test`: one sentence describing how to verify its intent - a command to run, a concrete check on the produced artifact, or an observable side-effect (API/MCP/state).
- **R9** - Auto-trigger skills (`disable-model-invocation: false`, default) ship `evals/scenarios.json` = JSON array of at least 3 `{prompt, expect_action}`. Manual-only skills skip.
- **R10** - Generated skills are written in **English only** (frontmatter, body, actions, references, assets). Holds regardless of conversation language.

## References (documents to read)

- `references/naming-conventions.md` - tool vs activity naming, hard constraints
- `references/skill-structure.md` - skill anatomy
- `references/agents-coordination.md` - multi-agent coordination patterns
- `references/rule-structure.md` - rule file anatomy
- `references/rule-writing.md` - rule authoring conventions
- `references/ide-mapping.md` - syntax and file location reference for AI files (agents, commands, rules, skills)

## Assets (templates to copy)

- `assets/skills/skill-template.md` - SKILL.md skeleton
- `assets/skills/action-template.md` - action file skeleton
- `assets/skills/evals-template.md` - `scenarios.json` minimal schema
- `assets/agents/agent-template.md` - agent file skeleton
- `assets/rules/rule-template.md` - rule file skeleton
