← [aidd-framework](../../../../README.md) / [aidd-vcs](../../README.md)

# 02 - Pull Request

Drafts a pull request (GitHub) or merge request (GitLab) from the current
branch using the team's template, validates it with the user, and opens it
as a draft for manual promotion.

## When to use

- The user says "open a pr", "open a pull request", "create a pr", "create a
  merge request", "open mr", or "draft a pr for this branch".
- The user invokes the `/pull-request` slash command.
- A feature branch is ready for review and needs a request opened against
  the detected base branch.

## When NOT to use

- To commit changes → use `01-commit`.
- To push the working branch on its own (no request created).
- To tag a release → use `03-release-tag`.
- To merge an existing request, or to amend commits.

## How to invoke

```
Use skill aidd-vcs:02:pull-request
```

Or via the slash command: `/pull-request`.

The skill runs a single action (`pull-request`) that detects the base
branch, fills the template, validates the title / body / base with the user,
then opens the request as a draft.

## Outputs

- A new draft pull request on GitHub, or a draft merge request on GitLab,
  pointing from the current branch to the detected base branch, with the
  filled template as its body.

## Prerequisites

- A git repository with a remote on GitHub or GitLab.
- The current branch is pushed (or the skill will defer to the user).
- `gh` (GitHub) or `glab` (GitLab) CLI authenticated, depending on the
  detected VCS tool.
- The base branch resolves from project memory or remote inspection; the
  skill does not assume `main` / `master`.

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract. Templates ship in
[`assets/`](assets/): `pull_request.md` (request body), `branch.md` (naming
conventions), `CONTRIBUTING.md`, and `README.md`.
