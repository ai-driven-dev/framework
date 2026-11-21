---
status: retrospective
---

# Design: Kilo-native generation in aidd-context

This is a retrospective synthesis. No original `design.md` was found in the historical task directory, its reachable Git history, or the local stash. Historical decisions below come from issue #914, the surviving plan and phase files, commit records, and the maintainer review. Interpretations are labeled as such.

## Need

[Issue #914](https://github.com/ai-driven-dev/framework/issues/914), opened 2026-09-23, asked `aidd-context` to recognize Kilo and emit artifacts through Kilo's documented native or configuration-backed surfaces. A Kilo-only project should be able to use onboarding, project memory, rules, skills, agents, and workflows without moving generated files or repairing configuration by hand. The issue also ruled out overwriting user context and inventing unsupported declarative hooks.

## Initial architecture

The issue and historical plan describe target-specific generation within the existing `aidd-context` workflows:

- Detect Kilo from its project signals, while not treating `AGENTS.md` or OpenCode configuration alone as proof of Kilo.
- Use root `AGENTS.md` for shared project memory and preserve user-authored content.
- Write new Kilo artifacts under `.kilo/`; use `.agents/skills/` only after an explicit portable-target choice.
- Put rules under `.kilo/rules/` and register their paths in a selected Kilo configuration.
- Preserve the existing Claude source templates and add target-specific rendering and validation.
- Give sourced JavaScript/TypeScript plugin guidance for hooks; do not emit unsupported declarative hooks.

These choices are documented in the issue and historical [plan](./plan.md). No separate architecture design artifact survives, so this summary does not claim to reproduce one.

## Constraints and tradeoffs

Configuration may be JSON or JSONC, may contain comments, duplicates, and user formatting, and may have more than one candidate file. Rule publication therefore needs explicit selection for ambiguous ownership and must preserve unrelated configuration. Kilo's rule files are config-backed, not automatically discovered. Portable skills improve reuse across tools but must not be written without user choice.

The historical plan reused the shared rule writer from #979 rather than creating a competing publisher. It kept Kilo-specific behavior in the existing `aidd-context` plugin and left CLI profile/distribution work to the boundaries already owned by #744 and #868. Hooks have a stricter limit: guidance may name only documented Kilo plugin paths and lifecycle mappings.

## Maintainer review and strategy revision

On November 5, the maintainer asked for Kilo-only scope, extraction of unrelated `skill-eval`, memory and hook work, coordination with the memory rewrite, and a rebase on `next`; the concern was conflict or lost work during that rewrite. The detailed chronology and the contributor's subsequent implementation choices are recorded in [the plan](./plan.md). The review is [here](https://github.com/ai-driven-dev/framework/pull/992#pullrequestreview-5767586134).

## Current design and limits

The current PR keeps Kilo detection, shared-memory projection, config-backed rules, native skills, agents and workflows, and sourced hook guidance. It adds deterministic native Kilo E2E coverage and platform CI. The checks exercise checked-in fixtures and a local scripted provider; they do not establish that every generated artifact was produced by a genuine LLM run. No authenticated Claude validation is claimed.

Historical phase status is preserved in the [plan](./plan.md) and individual phase records. In particular, phases 2 and 6 were historically `in-progress`; their outcomes are not retroactively marked complete.
