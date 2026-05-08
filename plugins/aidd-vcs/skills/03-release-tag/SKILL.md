---
name: aidd-vcs:03:release-tag
description: Cut a semver release with annotated tag and release notes. Use when the user says "release", "tag", "tag this release", "bump version", "release v1.2.0", "cut a release", or invokes `/release-tag`. Do NOT use for plain commits without a tag, opening pull requests, pushing a branch only, or amending existing tags.
---

# Release Tag

Cuts annotated semver releases with notes derived from recent commits.

## Available actions

| #   | Action         | Role                                                                       | Input                              |
| --- | -------------- | -------------------------------------------------------------------------- | ---------------------------------- |
| 01  | `release-tag`  | Compute version, draft notes, validate, bump, tag, push                    | version (optional), notes_overrides|

## Default flow

Single action skill. The router dispatches to `release-tag` whenever a release or tag phrase appears.

## Transversal rules

- Versions follow semver `major.minor.patch` strictly. No suffixes unless explicitly requested.
- Tags are annotated (`git tag -a`), never lightweight.
- Release notes are mandatory and follow `assets/release-template.md`.
- Always ask the user to validate the version, notes, and impacted files before tagging.
- Never `--force` push tags. Use `--force-with-lease` only when explicitly required.
- The bump commit only includes version-manager files (e.g. `package.json`, `pyproject.toml`).

## References

- None.

## Assets

- `assets/release-template.md`: Release notes template.

## External data

- None.
