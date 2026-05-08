---
name: aidd-vcs:04:issue-create
description: Create an issue in the configured ticketing tool. Use when the user says "new issue", "create an issue", "file a bug", "file an issue", "report bug", "open an issue", or invokes `/issue-create`. Do NOT use for committing changes, opening pull requests, tagging releases, or commenting on existing issues.
---

# Issue Create

Files well-formed issues in the configured tracker after gathering enough context to be actionable.

## Available actions

| #   | Action          | Role                                                                       | Input                                  |
| --- | --------------- | -------------------------------------------------------------------------- | -------------------------------------- |
| 01  | `issue-create`  | Detect tool, fill template, validate, open the issue                        | problem_description, labels, type      |

## Default flow

Single action skill. The router dispatches to `issue-create` whenever an issue or bug-report phrase appears.

## Transversal rules

- Detect the ticketing tool from project memory first, then fall back to inspecting `git remote get-url origin`.
- Tool-agnostic: invoke whichever ticketing tool is configured for the project.
- Always wait for explicit user approval of title, body, labels, type, projects, and milestones before creating.
- Issue body follows `assets/issue-template.md`.
- Be thorough and concise. Short sentences. Focus on clarity, reproduction steps, and expected behavior.
- Read `assets/CONTRIBUTING.md` for project-specific issue rules before drafting.

## References

- None.

## Assets

- `assets/issue-template.md`: Issue / ticket body template.
- `assets/CONTRIBUTING.md`: Contribution guidelines, including issue process.

## External data

- None.
