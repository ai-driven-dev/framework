# The startup greeting resolves the framework version locally, and unknown is shown rather than substituted

- Date: 2026-10-25
- Status: Accepted — implements the visible behavior of #980
- Decided by: proposed here, for @alexsoyes to confirm or overturn

## Context

#980 asks the startup greeting to carry the framework version. Three agent files shipped
three drifted greetings (`AGENTS.md`, `CLAUDE.md`, `cli/CLAUDE.md`), and the candidate
version sources disagree in kind:

- Root `package.json` says `0.0.0`: the root package is private and unpublished, its
  version field is a placeholder, not a release.
- `.release-please-manifest.json` holds the framework release under the `"."` key.
- `.claude-plugin/marketplace.json` carries the same number in its `version` field, and
  release-please bumps it as an extra-file of the root package on every framework release.
- `cli/package.json` is the CLI version and `plugins/*/.claude-plugin/plugin.json` are
  plugin versions; #980 forbids substituting either for the framework version.

## Decision

The greeting resolves `<version>` from the `version` field of `.claude-plugin/marketplace.json`
at the repository root. That file is the marketplace manifest a native install fetches, and
release-please keeps it equal to the `"."` entry of `.release-please-manifest.json`, so the two
agree by construction. If the file cannot be read, the greeting displays
`Framework version unknown`. The CLI version, a plugin version, and the root `package.json`
placeholder are never substituted.

The greeting itself is unified across `AGENTS.md`, `CLAUDE.md`, and `cli/CLAUDE.md`:

> AI-Driven Development On ⚡ · Framework v<version> · [Releases](https://github.com/ai-driven-dev/framework/releases)

## Consequences

- A framework checkout (this repository, a git tag, a local marketplace directory) resolves
  the version on the first message of every new conversation, and after an upgrade the next
  conversation resolves the updated version, because release-please bumps the file.
- A user project installed from the marketplace holds no framework file at its root, so it
  displays `Framework version unknown` until install-time provenance lands. That is the
  fallback #980 explicitly allows, not a silent wrong answer.
- The shipped project template (`aidd-context` `02-project-memory`) intentionally carries no
  greeting since 4446fff; this decision does not reinstate one there.
- The three drifted greetings collapse into one, closing the drift #619 tracked.

## Overturning

Two facts would justify revisiting: the CLI starts recording the marketplace version in
`.aidd/manifest.json` at install time (the greeting chain gains a second, install-provenance
source), or the project template regains a greeting (the same rule applies there verbatim).
