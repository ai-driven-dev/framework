---
name: aidd-vcs:01:commit
description: Create an atomic git commit with conventional message format. Use when the user says "commit", "git commit", "create a commit", "commit my changes", "commit and push", or invokes `/commit`. Do NOT use for amending existing commits, force-pushing, rebasing, opening pull requests, or release tagging.
---

# Commit

Generates atomic git commits with conventional messages, supporting interactive splits and agent-driven auto mode.

## Available actions

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
- Follow the conventional commit format defined in `assets/commit-template.md`.
- Reference issues in the commit body when applicable.
- `auto` mode never asks for confirmation. `interactive` mode requires user approval before staging and before committing splits.

## References

- None.

## Assets

- `assets/commit-template.md`: Conventional commit format reference.

## External data

- None.
