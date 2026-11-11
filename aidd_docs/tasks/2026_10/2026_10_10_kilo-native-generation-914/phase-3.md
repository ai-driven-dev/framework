---
status: historical-done-current-retained
---

# Phase 3: Native or explicitly portable skills

Historical instruction: [phase-3 manifest commit](https://github.com/ai-driven-dev/framework/commit/442091f288788e185c3586f87e4c3531c1a5cbe9). Historical status: `done`. Current scope status: retained.

## Architecture projection

- Kilo-native skills go under `.kilo/skills/<name>/`.
- `.agents/skills/<name>/` is offered only after the user explicitly selects the portable target; one generation must not create both copies.
- Preserve user-owned actions/assets and validate the target-specific skill format.

Current implementation is in `plugins/aidd-context/skills/04-skill-generate/` and its native/portable fixtures under `scripts/__tests__/fixtures/context-generation/skills/`.

## Test Scope

Contract and artifact fixtures cover paths, format, preservation, collision/refusal, and idempotence. Current Kilo E2E uses checked-in fixtures and a deterministic local provider; it does not prove that all saved fixtures were emitted by an LLM running the generator.

## Tasks to do

- Historical: add the Kilo target, explicit portable selection, target-specific rendering, and runtime evidence. Marked `done` in the archived phase record.
- Current: retain this generation surface and its fixture/runtime checks. Do not restore the removed broad `skill-eval` host support.

## Test acceptance criteria

| Criterion | Current evidence/status |
| --- | --- |
| Native target is `.kilo/skills/` with valid Agent Skills structure. | Contract fixtures and Kilo native E2E. |
| Portable target requires explicit choice and produces one location. | Generator contract tests. |
| Existing user files survive update/refusal paths. | Artifact tests and fixture assertions. |
| Runtime discovers and invokes the tested skill. | Current CI E2E with scripted local provider; not a general LLM evaluation. |
