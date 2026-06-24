---
name: 00-repo-init
description: Initialize a project's repository - resolve the default branch and VCS provider, run git init with a bootstrap commit, write CONTRIBUTING.md, and on request create the remote repository and push. Use when the user says "init a repo", "git init", "initialize version control", "set up a new repo", "start a project", "create the remote and push", or "publish this repo". Do NOT use for committing changes (use 01-commit), opening pull requests (use 02-pull-request), tagging releases (use 03-release-tag), or cloning an existing remote.
argument-hint: init | publish
---

# Repo Init

Initializes a project's repository locally and, on request, on the remote host, then returns the remote URL.

## Available actions

| #   | Action    | Role                                                                                              | Input                           |
| --- | --------- | ------------------------------------------------------------------------------------------------- | ------------------------------- |
| 01  | `init`    | Resolve VCS config, `git init`, set the default branch, write `CONTRIBUTING.md`, bootstrap commit | cwd, default_branch, remote_url |
| 02  | `publish` | Create the remote repo on the resolved host and push, return its URL                              | cwd, non_interactive            |

## Default flow

Chain `01 → 02`, testing each before the next. The router runs `init` alone for a local-only request, and runs `publish` after an `init` when asked to create the remote.

## Transversal rules

- The local step is idempotent. If the target is already a git work tree, `init` does nothing and reports.
- `init` makes one bootstrap commit (`--allow-empty`) so `HEAD` exists and is pushable. The project's real first commit stays the commit skill's job.
- `publish` is outward-facing. It confirms before creating the remote unless `non_interactive` is set.
- The provider is open. Resolve the host and how to reach it (CLI, MCP, or API) from the VCS memory when present, else from the VCS tooling available in the environment. Never restrict to a fixed list or a fixed mechanism. `main` is the default-branch fallback.

## Assets

- `assets/CONTRIBUTING.md`: the project-root `CONTRIBUTING.md` template.

## External data

- `aidd_docs/memory/vcs.md`: the project's VCS config (default branch, provider), read by both actions when present and pointed to, never copied.
