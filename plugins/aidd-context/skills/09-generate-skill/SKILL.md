---
name: generate-skill
description: Generate and maintain router-based Claude Code skills — SKILL.md router + atomic testable actions + minimal evals. Use when the user wants to create a new skill, refactor an existing skill, add or remove actions, or migrate a slash command into a skill. Do NOT use for editing a single action inside an existing skill (edit directly), creating slash commands (no router needed), writing MCP servers, or modifying project-level CLAUDE.md files.
---

# Generate Skill

Produces Claude Code skills following a router-based architecture: SKILL.md as pure router, actions as atomic testable operations, evaluations written before implementation.

## Available actions

| #   | Action              | Role                                          | Input              |
| --- | ------------------- | --------------------------------------------- | ------------------ |
| 01  | `capture-intent`    | Clarify output + decide generate vs modify    | user intent        |
| 02  | `design-evals`      | Write minimal `scenarios.json`                | expected output    |
| 03  | `decompose-actions` | List actions + their tests                    | evals + output     |
| 04  | `draft-skill`       | Write SKILL.md router                         | decomposed actions |
| 05  | `write-actions`     | Write each action file                        | validated SKILL.md |
| 06  | `validate`          | Spawn one agent per action, run its `## Test`, aggregate into a pass/fail report | complete skill |

## Default flow

`01 → 02 → 03 → 04 → 05 → 06`. After each action, run its `## Test` before moving to the next. Action 02 self-skips when `01` outputs `invocation_mode = manual`.

## Modify flow

`01` (detects modify) → `03` (re-decompose if structure changes) → `05` (targeted edit) → `06` (re-validate).

## Runtime tracking

Materialize the flow as a task list at skill entry; a task closes only when its `## Test` passes.

## Rules

- **R1** — SKILL.md is a pure router: description + action table + transversal rules. Zero business logic.
- **R2** — One skill = one domain (tool OR activity). Tool → singular noun (`slack`); activity → action verb (`review`). See `references/naming-conventions.md`.
- **R3** — References one-level deep. Never chain reference → reference.
- **R4** — SKILL.md ≤ 500 lines. If exceeded, split into references.
- **R5** — Description must include: what, explicit triggers, "Do NOT use for..." clause.
- **R6** — Zero duplication. Templates live in `assets/`; actions point to them via `@<path>`.
- **R7** — `references/` = documents to READ (conventions, cheatsheets). `assets/` = files to COPY or INJECT (templates, ID tables).
- **R8** — Every action has a `## Test`: one sentence describing how to verify its intent — a command to run, a concrete check on the produced artifact, or an observable side-effect (API/MCP/state).
- **R9** — Auto-trigger skills (`disable-model-invocation: false`, default) ship `evals/scenarios.json` = JSON array of at least 3 `{prompt, expect_action}`. Manual-only skills skip.
- **R10** — Generated skills are written in **English only** (frontmatter, body, actions, references, assets). Holds regardless of conversation language.

## References (documents to read)

- `references/naming-conventions.md` — tool vs activity naming, hard constraints

## Assets (templates to copy)

- `assets/skill-template.md` — SKILL.md skeleton
- `assets/action-template.md` — action file skeleton
- `assets/evals-template.md` — `scenarios.json` minimal schema
