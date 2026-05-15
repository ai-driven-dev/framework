← [aidd-framework](../../../../README.md) / [aidd-vcs](../../README.md)

# 04 - Issue Create

Files a well-formed issue in the configured ticketing tool after gathering
enough context to be actionable, validated with the user before creation.

## When to use

- The user says "new issue", "create an issue", "file a bug", "file an
  issue", "report bug", or "open an issue".
- The user invokes the `/issue-create` slash command.
- A bug or feature request surfaces during work and needs a tracked record
  in whichever ticketing tool the project uses.

## When NOT to use

- To commit changes → use `01-commit`.
- To open a pull or merge request → use `02-pull-request`.
- To cut a release tag → use `03-release-tag`.
- To comment on an existing issue (this skill only creates new ones).

## How to invoke

```
Use skill aidd-vcs:04:issue-create
```

Or via the slash command: `/issue-create`.

The skill runs a single action (`issue-create`) that detects the ticketing
tool, fills the issue template, validates title / body / labels / type /
projects / milestones with the user, then creates the issue.

## Outputs

- A new issue in the configured tracker (GitHub Issues, GitLab Issues, Jira,
  Linear, or whichever tool project memory points at) with the filled
  template body, requested labels, type, projects, and milestones.

## Prerequisites

- The project memory identifies the ticketing tool, or the remote URL
  reveals it via `git remote get-url origin`.
- The matching CLI is authenticated (`gh`, `glab`, etc.) or the tool's API
  credentials are configured.
- The user is available to approve the draft before the issue is filed;
  the skill always waits for explicit confirmation.

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract. Templates ship in
[`assets/`](assets/): `issue-template.md` (issue body) and `CONTRIBUTING.md`
(project-specific issue rules consulted before drafting).
