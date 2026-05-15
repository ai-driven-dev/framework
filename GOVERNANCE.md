# Governance

How decisions get made in the AI-Driven Dev Framework.

## Project structure

- **Maintainers**: a small group with merge rights on `main`. Listed in [`.github/CODEOWNERS`](./.github/CODEOWNERS) and on the GitHub organisation page.
- **Plugin owners**: maintainers responsible for the day-to-day of a specific plugin (`aidd-context`, `aidd-dev`, etc.). They merge per-plugin PRs and triage per-plugin issues.
- **Contributors**: anyone who opens a PR or issue. The contribution flow is documented in [`CONTRIBUTING.md`](./CONTRIBUTING.md).
- **Community**: the wider AIDD community on Discord, YouTube, and LinkedIn. Sets direction by feedback, votes on roadmap items, and proposes new use cases.

## How decisions are made

The default is **lazy consensus**. Any maintainer can move forward on a PR if:

1. No other maintainer has expressed an objection within 72 hours.
2. The PR has at least one approval from a maintainer (or from a plugin owner for plugin-scoped changes).
3. The PR passes CI and lefthook checks.

Anyone can pause a PR by leaving a `request-changes` review or a `block` comment explaining the concern. The PR cannot merge until the concern is resolved.

For changes that affect more than one plugin, the contract surface (skill frontmatter, marketplace.json schema), or the project's licensing / governance, lazy consensus is replaced with **explicit consensus**: at least two maintainers approve, no maintainer objects.

## Adding a new plugin

A new plugin lands through a regular pull request that:

1. Follows the layout described in [`docs/CREATE_PLUGIN.md`](docs/CREATE_PLUGIN.md).
2. Includes a `description` frontmatter on every skill clear enough that a Claude session can discover it from intent alone.
3. Declares at least one `evals/scenarios.json` fixture per skill.
4. Adds the plugin entry to `.claude-plugin/marketplace.json` and registers it in `release-please-config.json`.
5. Has a plugin owner ready to take ongoing responsibility for issues and PRs against the plugin.

A new plugin starts at `status: experimental`. It moves to `release candidate` once at least one external user has installed and reported a successful run, and to `stable` after a maintainer review of the eval coverage and the documentation.

## Removing or deprecating a plugin

A plugin can be deprecated by any maintainer with a one-paragraph rationale and at least one alternative path (a sibling plugin, an external project) for users to migrate to. Deprecation moves the plugin to `status: deprecated` in the README table and adds a banner in the plugin's own README. After 90 days the plugin can be removed entirely; until then it stays installable.

## Breaking changes

Breaking changes follow Conventional Commits with the `!` suffix (`feat!:`, `refactor!:`, etc.). Major bumps trigger an automatic release-please PR. The release notes must document the migration path for any user-visible contract (skill name, manifest field, public env variable).

Prompt-only changes that alter how a skill behaves without changing its name or inputs still constitute breaking changes from the user's perspective. They should be flagged in the PR description and announced on Discord before merge.

## Conflicts of interest

A maintainer or plugin owner with a direct stake in a PR (e.g. their employer or a paid integration) should disclose it in the PR description and abstain from being the sole approver. The lazy-consensus window stays the same, but a second maintainer approval becomes mandatory.

## Branch protection on `main`

Direct pushes to `main` are forbidden; every change lands through a pull request that satisfies the rules below. The machine-readable form lives at [`.github/rulesets/main.json`](.github/rulesets/main.json) and can be applied with:

```
gh api -X POST /repos/ai-driven-dev/aidd-framework/rulesets --input .github/rulesets/main.json
```

Rules:

- **Pull request required.** No direct push to `main`, no force-push, no deletion.
- **At least one approving review** from a maintainer (CODEOWNERS-aware).
- **Required status checks**: `lefthook (framework-local checks)` (the [`validate`](.github/workflows/validate.yml) workflow) and `Commitlint` (from the [`CI`](.github/workflows/ci.yml) workflow) must pass.
- **Unresolved review threads block merge.**

The ruleset depends on GitHub's repository-rulesets API, which is free on public repos and bundled with paid plans on private repos. While the repo is private and on the free plan the rules are documented but not enforced by GitHub; they are enforced socially by maintainers.

## Code of Conduct

All decisions and interactions are bound by the [Code of Conduct](./CODE_OF_CONDUCT.md). Enforcement contacts are listed there.

## Amendments

This document is itself versioned. Changes to governance follow the same explicit-consensus rule above.
