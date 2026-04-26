---
description: 'Standards for naming, organizing, and writing command files. Apply when creating or editing any command file.'
---

# Command file structure

## File naming

- Follow IDE mapping conventions for path
- Name matches frontmatter `name:` field
- Slugified, lowercase, underscore-separated

## Frontmatter format

- `name:` slugified file name
- `description:` action-oriented summary
- `argument-hint:` concise argument description (if applicable)
- `model:` preferred model (sonnet, opus)

## SDLC Phase Taxonomy

Each command belongs to one phase:

| Phase | Category        | Examples                                               |
| ----- | --------------- | ------------------------------------------------------ |
| `01`  | `onboard`       | Framework setup, generators, prompt scaffolding        |
| `02`  | `context`       | Discovery, PRD, user stories, brainstorming, flows     |
| `03`  | `plan`          | Technical planning, component behavior, image analysis |
| `04`  | `code`          | Implementation, assertions, frontend validation        |
| `05`  | `review`        | Code review, functional review                         |
| `06`  | `tests`         | Test writing, user journey testing, untested listing   |
| `07`  | `documentation` | Learning, JIRA info, Mermaid diagrams                  |
| `08`  | `deploy`        | Commits, pull/merge requests, tagging                  |
| `09`  | `refactor`      | Performance optimization, security refactoring         |
| `10`  | `maintenance`   | Debugging, issue tracking, codebase audits             |

## Content rules

- "$ARGUMENTS" is reserved keyword for command param
- Less is more, minimal context
- Single objective per command
- Steps < 10
- Written in english
- No markdown formatting in output
- Use `!` backtick pattern for CLI execution
- No "Role & Expertise" section (the role is implicit in the Goal)
