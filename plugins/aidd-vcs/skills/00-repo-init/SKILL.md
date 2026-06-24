---
name: 00-repo-init
description: Initialize a project's repository: resolve the default branch and VCS provider, run git init with a bootstrap commit, write CONTRIBUTING.md, and on request create and push the remote. Use when the user says "init a repo", "git init", "initialize version control", "set up a new repo", "start a project", or "publish this repo". Do NOT use to commit changes, open a pull request, tag a release, or clone an existing remote.
argument-hint: init | publish
---

# Repo Init

Initializes a project's repository locally and, on request, on the remote host, then returns the remote URL.

## Actions

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

- `@assets/CONTRIBUTING.md`: the project-root `CONTRIBUTING.md` template.
