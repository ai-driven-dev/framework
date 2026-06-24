← [aidd-vcs](../../README.md)

# 00-repo-init

Initializes a project's repository locally and, on request, on the remote host: `git init`, sets the default branch, resolves the provider, and can create the remote repository and push, returning its URL.

> Status: experimental.

## When to use

- Starting version control on a new project (e.g. right after scaffolding it).
- Creating the remote repository and pushing the initial state.

## When NOT to use

- Cloning an existing remote, opening pull requests, or tagging releases.
- Re-initializing a directory that is already a repository (the local step no-ops there).

## How to invoke

`aidd-vcs:00-repo-init`, or say "initialize a git repository here" / "create the remote and publish".

## Outputs

- `init`: an initialized `.git`, the default branch set, the resolved provider, and `origin` added when a remote URL is given.
- `publish`: the created remote repository and a push, returning its URL.

## Prerequisites

- `git` on the PATH. For `publish`, the resolved host's tooling (CLI, MCP, or API) available and authenticated.

## Technical details

Two actions: `init` (local) and `publish` (remote, outward-facing, confirms first). See [SKILL.md](SKILL.md).
