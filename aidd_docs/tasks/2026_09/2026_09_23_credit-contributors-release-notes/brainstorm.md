# Credit contributors in release notes

Refines [#911](https://github.com/ai-driven-dev/framework/issues/911).

Every line of the generated release notes ends with the GitHub `@handle` of the commit's author, Symfony-style, for the root release and for each plugin and cli release. The point is to make everyone who ships visible, release after release, maintainer included. Attribution was meant to rely on release-please's native `include-commit-authors` option; a sandbox run proved it a no-op (upstream googleapis/release-please#2761), so a step post-processes each GitHub release instead. `main` accepts only merge commits, so a promote always keeps every commit and its author.

## What Is Clear

- Per-line credit only. No contributor section at the end of a release, no deduplication.
- Everyone is credited, maintainer included.
- A plugin release credits only the authors of that plugin's commits, because release-please builds each component's notes from its own commits.
- `include-commit-authors` exists but credits nobody in 17.11.2: `parseConventionalCommits` drops the author. Fix pending upstream in #2892; the post-processing step is removed once it ships.
- `changelog-type: github` is rejected: it reads the whole range between tags, which is wrong for component releases.
- `(@dependabot[bot])` on dependency lines is accepted.
- Verified on the last 60 PRs merged into `next`: the squash commit's author is the PR author (55/55 humans), even when someone else merges. Every commit email resolves to a GitHub account.
- Promote to `main` is a merge commit today (`promote.yml`, #809), which keeps each commit and its author. It stays as is.
- Guard: `main` allows only merge commits. A squashed promote would silently drop the week's entries (proven in the sandbox). The release PR moves to `--merge --admin`, and the live ruleset changes only after that has released once.
- Only the GitHub releases carry the handles; `CHANGELOG.md` and the release PR body do not. Accepted.
- A multi-author PR credits its author only; `Co-authored-by:` trailers are ignored. Accepted.
- Out of scope: other forms of contribution (issues, reviews, discussions), and a weekly shout-out on overall contribution, which gets its own issue.

## Still Open

- None. Settled in planning; see `plan.md`.

## Next Move

Implement `plan.md`.
