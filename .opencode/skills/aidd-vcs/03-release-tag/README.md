← [aidd-framework](../../../../README.md) / [aidd-vcs](../../README.md)

# 03 - Release Tag

Cuts a semver release: computes the next version, drafts notes from recent
commits, validates with the user, bumps version-manager files, creates an
annotated git tag, and pushes it.

## When to use

- The user says "release", "tag", "tag this release", "bump version",
  "release v1.2.0", or "cut a release".
- The user invokes the `/release-tag` slash command.
- A release-ready commit exists on the release branch and needs a versioned
  tag with notes.

## When NOT to use

- For plain commits without a tag → use `01-commit`.
- To open a pull or merge request → use `02-pull-request`.
- To push a branch only, with no tag created.
- To amend or move an existing tag (this skill never force-updates tags).

## How to invoke

```
Use skill aidd-vcs:03:release-tag
```

Or via the slash command: `/release-tag`.

The skill runs a single action (`release-tag`) that computes the version,
drafts notes, validates with the user, applies the version bump, creates the
annotated tag, and pushes it.

## Outputs

- A version-bump commit touching only version-manager files (e.g.
  `package.json`, `pyproject.toml`).
- An annotated git tag (`git tag -a vX.Y.Z`) carrying the release notes.
- The bump commit and the tag pushed to the remote.

## Prerequisites

- A git repository with a writable remote.
- A version-manager file the skill can update (e.g. `package.json`,
  `pyproject.toml`).
- A clean working tree, or changes the user is willing to bundle into the
  bump commit when prompted.

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract. The release notes
template ships at [`assets/release-template.md`](assets/release-template.md).
