# VCS

The version-control conventions this project follows: branches, commits, and the platform.

## Setup

- Main branch: `<main, master, trunk>`
- Platform: `<github, gitlab, bitbucket>`

## Branches

- Format: `<type/ticket-short-description>`
- Types in use: `<feat, fix, chore, ...>`

## Commits

- Convention: `<conventional commits, or the project's own>`
- Format: `<type(scope): description>`
- Rules: `<imperative mood, lowercase, max length>`

## Hooks

- Pre-commit, under a minute: `<format and lint the staged files, test the changed files>`
- Pre-push, as long as it takes: `<the full suite, integration, mutation, build>`

## Commit Strategy

AI should auto commit: `never|after phase|after feature|after task done|post-tests`

<!--
Capture: the project's actual VCS choices. If they follow a standard, name it and point to the doc.
Skip: re-explaining a standard in full. Capture the specifics and deviations.
Hooks: an agent commits per task; a pre-commit that runs the full suite turns each commit into a long wait, and the agent polls instead of working.
Remove this comment when filled.
-->
