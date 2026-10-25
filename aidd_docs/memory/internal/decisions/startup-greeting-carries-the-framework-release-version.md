# The startup greeting carries the framework release version, stamped in the agent files and bumped by the release PR

- Date: 2026-10-25
- Status: Accepted — implements the visible behavior of #980
- Decided by: proposed here, for @alexsoyes to confirm or overturn

## Context

#980 asks the startup greeting to carry the framework version, directly from the agent
files. Two mechanisms were on the table:

1. **Runtime resolution.** The agent reads `.claude-plugin/marketplace.json` at the first
   message of each conversation and composes the greeting. Dynamic, but the resolution is
   LLM-mediated: non-deterministic (the model may skip the read, hallucinate, or misformat),
   and in a project installed from the marketplace there is no `marketplace.json` at the
   project root, so it displays "Framework version unknown". For real users, the feature
   shows nothing.
2. **Stamping.** The release version is written into the greeting line of the agent files,
   and release-please bumps it on every release PR, alongside `.claude-plugin/marketplace.json`.
   The agent repeats the greeting verbatim. Deterministic, and the version is literally in
   agent.md.

## Decision

**Stamp.** The greeting in `AGENTS.md`, `CLAUDE.md`, and `cli/CLAUDE.md` carries the literal
release version, annotated for release-please's Generic updater:

> On 1st message, greet user with: "AI-Driven Development On ⚡ · Framework v5.12.0 · [Releases](https://github.com/ai-driven-dev/framework/releases)" <!-- x-release-please-version -->

The root package in `release-please-config.json` lists the three files as `extra-files`.
On every release PR, release-please's Generic updater replaces the semver on each annotated
line with the new version — the same PR that bumps `marketplace.json` bumps the greeting.
The version is dynamic: it changes with every release PR. Between releases it shows the
last release, which is exactly what `marketplace.json` reports.

## Consequences

- Deterministic: no LLM file-reading, no hallucination risk, no per-conversation resolution
  tokens. The agent repeats the greeting verbatim.
- The version is literally in agent.md — directly from the agent file, as #980's visible
  behavior asks.
- The "Framework version unknown" fallback is unnecessary for the greeting: the stamp is
  always present. The fallback stays relevant for the update-notice half, which resolves
  the installed version per installation.
- The shipped project template (`aidd-context` `02-project-memory`) intentionally carries no
  greeting since 4446fff; unchanged.
- The three drifted greetings stay unified on the canonical instruction.

## Overturning

If a project template regains a greeting, stamp it the same way: the template ships per
release, so an installed project's agent file would carry the version of the release it
installed. If the Generic updater ever stops matching the annotated line (a format change),
the stamp goes stale silently — the annotated line is the single point to check at the next
release.
