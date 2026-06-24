---
name: 01-commit
description: Create an atomic git commit with a conventional message, optionally pushing. Use to commit changes ("commit", "/commit push"). Do NOT use to amend, rebase, open a PR, or tag a release.
---

# Commit

Generates atomic git commits with conventional messages, supporting interactive splits and agent-driven auto mode.

## Actions

| #   | Action   | Role                                                          | Input                                       |
| --- | -------- | ------------------------------------------------------------- | ------------------------------------------- |
| 01  | `commit` | Stage, generate or accept a message, commit, optionally push   | mode, message, push, files                  |

## Default flow

Single action skill. The router dispatches to `commit` whenever a commit phrase or slash command appears.

## Inline arguments

When invoked as a slash command, the trailing argument controls the push behavior:

- `/commit` → commits only, stays local (`push: false`)
- `/commit push` → commits then pushes the branch (`push: true`)

## Transversal rules

- Commits stay atomic and focused on a single concern.
- Messages use imperative mood ("Add feature" not "Added feature").
- Explain "why" not "what" in the body.
- Never `--force` push. `--force-with-lease` is acceptable when explicitly required.
- Follow the conventional commit format defined in `@assets/commit-template.md`.
- Reference issues in the commit body when applicable.
- `auto` mode never asks for confirmation. `interactive` mode requires user approval before staging and before committing splits.

## Assets

- `@assets/commit-template.md`: Conventional commit format reference.
