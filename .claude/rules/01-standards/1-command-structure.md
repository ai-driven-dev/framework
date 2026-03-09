---
paths:
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

| Phase | Category      | Examples                                                  |
| ----- | ------------- | --------------------------------------------------------- |
| 01    | Onboard       | Framework setup, generators, prompt scaffolding           |
| 02    | Context       | Discovery, PRD, user stories, brainstorming, flows        |
| 03    | Plan          | Technical planning, component behavior, image analysis    |
| 04    | Code          | Implementation, assertions, frontend validation           |
| 05    | Review        | Code review, functional review                            |
| 06    | Tests         | Test writing, user journey testing, untested listing      |
| 07    | Documentation | Learning, JIRA info, Mermaid diagrams                     |
| 08    | Deploy        | Commits, pull/merge requests, tagging                     |
| 09    | Refactor      | Performance optimization, security refactoring            |
| 10    | Maintenance   | Debugging, issue tracking, codebase audits                |

## Content rules

- "$ARGUMENTS" is reserved keyword for command param
- Less is more, minimal context
- Single objective per command
- Steps < 10
- Written in english
- No markdown formatting in output
- Use `!` backtick pattern for CLI execution
- No "Role & Expertise" section (the role is implicit in the Goal)
