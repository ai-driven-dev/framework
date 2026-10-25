# The startup greeting carries the framework release version, synced by a transformation script

- Date: 2026-10-25
- Status: Accepted — implements the visible behavior of #980
- Decided by: proposed here, for @alexsoyes to confirm or overturn

## Context

#980 asks the startup greeting to carry the framework version, directly from the
agent files. Three mechanisms were considered:

1. **Runtime resolution by the agent.** The agent reads `.claude-plugin/marketplace.json`
   at the first message of each conversation. Non-deterministic (the model may skip the
   read, hallucinate, or misformat), and in a project installed from the marketplace there
   is no `marketplace.json` at the project root, so it displays "Framework version unknown".
2. **Release-time stamping by release-please** (`extra-files` with an
   `x-release-please-version` annotation). Deterministic, but it ties the greeting's
   upkeep to the release tooling's file list.
3. **A transformation script** (`scripts/sync-greeting-version.mjs`) that reads the
   framework release version and stamps it into the greeting of every target file.

The framework's purpose is to generate information dynamically with tooling, not to ask
the model to resolve it or to hardcode it.

## Decision

**A transformation script.** `scripts/sync-greeting-version.mjs` reads the framework
release version from `.claude-plugin/marketplace.json` (the version as cut on the next
branch) and rewrites `Framework v<semver>` on the greeting line of every target:

- `AGENTS.md`, `CLAUDE.md`, `cli/CLAUDE.md` — the framework's own agent files;
- `plugins/aidd-context/skills/02-project-memory/assets/templates/AGENTS.md` — the usage
  template shipped to user projects, which becomes their AGENTS.md.

The script is idempotent and supports `--check` (report instead of write). A lefthook
pre-commit hook (`sync-greeting-version`) runs it on every commit and re-stages the
touched files, so the greeting never drifts from the release.

The greeting is one canonical line everywhere:

> On 1st message, greet user with: "AI-Driven Development On ⚡ · Framework v5.12.0 · [Releases](https://github.com/ai-driven-dev/framework/releases)"

## Consequences

- Deterministic: the agent repeats the greeting verbatim; no file-reading, no
  hallucination risk, no per-conversation resolution tokens.
- The version is dynamic: the script re-stamps it from the release version, and the
  pre-commit hook keeps every target in sync at the next commit after the version changes.
- The version is literally in the agent files, and the usage template carries it too:
  a project set up from a release greets with the version of that release.
- The "Framework version unknown" fallback is unnecessary: the stamp is always present.
- The shipped template intentionally had no greeting since 4446fff; #980 reinstates it
  with the version, stamped by the script.

## Overturning

If the version source ever moves out of `.claude-plugin/marketplace.json`, the script's
single read point changes with it. If the greeting format changes, the script's line
match is the single point to update.
