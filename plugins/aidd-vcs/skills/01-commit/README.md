← [aidd-framework](../../../../README.md) / [aidd-vcs](../../README.md)

# 01 - Commit

Creates an atomic git commit with a conventional, imperative-mood message,
optionally pushing the branch when the caller asks for it.

## When to use

- The user says "commit", "git commit", "create a commit", "commit my
  changes", or "commit and push".
- The user invokes the `/commit` slash command.
- An agent has finished a contained change and needs it recorded as a single
  atomic commit.

## When NOT to use

- To amend an existing commit (this skill always creates a new one).
- To force-push or rebase the current branch.
- To open a pull or merge request → use `02-pull-request`.
- To cut a release tag → use `03-release-tag`.

## How to invoke

```
Use skill aidd-vcs:01-commit
```

Or via the slash command:

- `/commit` - stage, commit, stay local (`push: false`).
- `/commit push` - stage, commit, then push the branch (`push: true`).

The skill runs a single action (`commit`) that stages, generates or accepts a
message, commits, and optionally pushes.

## Outputs

- One new git commit on the current branch with a conventional message.
- Optionally, a pushed branch on the remote when `push: true`.

## Prerequisites

- A git repository with at least one staged or unstaged change.
- A configured git identity (`user.name`, `user.email`).
- A writable remote when `push: true`.

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract and
[`assets/commit-template.md`](assets/commit-template.md) for the conventional
commit format reference shipped with the skill.
