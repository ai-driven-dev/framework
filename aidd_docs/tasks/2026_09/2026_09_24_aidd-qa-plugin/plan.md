---
objective: "An installable, off-curated-path aidd-qa plugin owns browser acceptance QA derived from acceptance criteria, and aidd-dev keeps only a redirect for the old invocation."
status: implemented
---

# Plan: aidd-qa plugin

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Create `aidd-qa`, move Browser QA into it as acceptance QA, retire the `aidd-dev` skill to a redirect, register the plugin everywhere a plugin is registered |
| **Source** | https://github.com/ai-driven-dev/framework/issues/908 |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Scaffold `aidd-qa` with the acceptance QA skill | [`phase-1.md`](./phase-1.md) |
| 2 | Retire `aidd-dev:11-browser-qa` to a redirect | [`phase-2.md`](./phase-2.md) |
| 3 | Register the plugin and update the docs | [`phase-3.md`](./phase-3.md) |
| 4 | Prove it installs and translates to a second host | [`phase-4.md`](./phase-4.md) |

## Resources

| Source | Verified |
| --- | --- |
| `docs/CREATE_PLUGIN.md` | registration = marketplace entry with `metadata.recommended: false`, release-please config and manifest; no cross-plugin reference in descriptions or READMEs |
| `docs/ARCHITECTURE.md` + `scripts/__tests__/architecture-doc-matches-the-tree.test.js` | the concerns table must hold one row per plugin in the tree |
| `scripts/__tests__/release-covers-every-plugin.test.js` | `ci.yml` `build-plugin` matrix and `release-please-config.json` must list every marketplace plugin |
| `scripts/lib/architecture-rules.js` (`PLUGIN_ADDRESS`) | any `aidd-<x>:<y>` token (optional `/` or `@`) in a skill, action, reference or agent of another plugin is an orthogonality violation; a bare plugin name or `aidd-qa@aidd-framework` is not |
| commit 627408fb (aidd-telemetry added) | touchpoints for a new plugin: marketplace, release manifest, README, memory; `.claude/settings.json` enables only curated plugins |
| PR #512 (Browser QA landed) | `aidd-vcs` pull-request draft links `**/qa/*.webm`; keeping the `qa/` evidence folder name keeps that link working |

## Decisions

| Decision | Why |
| --- | --- |
| Skill `aidd-qa:01-acceptance-qa`, browser as its only interface, declared in an interface reference | the entry point is named by intention (acceptance validation), so API or CLI interfaces can be added later without renaming; none is claimed now |
| Layer Execution in the taxonomy | it drives the running application, which the Knowledge firewall forbids |
| `aidd-dev:11-browser-qa` becomes a one-action redirect, not a deletion | an existing invocation gets an explicit migration message and `aidd-dev` needs no major bump; its description is written so description matching never routes QA work to it |
| `aidd-dev:06-test` `test-journey` stays in `aidd-dev` | it is developer-side validation the SDLC Deliver zone runs before commit, not independent acceptance evidence; moving it is outside #908 |
| Evidence folder stays `qa/` with `happy-path.webm` and `edge-case-<slug>.webm` | the pull-request draft already links `**/qa/*.webm` |
| Version `0.1.0` in `plugin.json` and the release manifest | new, unproven plugin, same pre-1.0 pattern as `aidd-telemetry` |
| Not added to `.claude/settings.json` `enabledPlugins` | that list holds only curated plugins; `aidd-ui` and `aidd-telemetry` are absent too |
| Commits split by path | release-please bumps per path from the commit type |
