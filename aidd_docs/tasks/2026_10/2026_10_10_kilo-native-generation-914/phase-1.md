---
status: historical-done-current-adapted
---

# Phase 1: Kilo detection and shared project memory

Historical instruction: [original phase file in the archived worktree](https://github.com/ai-driven-dev/framework/commit/859994ca12b8b1d1daf0f3e06316fa0b2feaf7ef). Historical status: `done`. Current scope status: Kilo-specific detection and memory projection delivered; unrelated memory-engine hardening is excluded.

## Architecture projection

- Detect Kilo from its documented signals; `AGENTS.md` or OpenCode-only configuration alone is not a Kilo signal.
- Use root `AGENTS.md` as the shared memory surface and preserve the user's content.
- Keep this behavior within existing `aidd-context` detection and project-memory flows.

Current implementation: `plugins/aidd-context/skills/00-onboard/references/state/detection.md`, `plugins/aidd-context/skills/02-project-memory/references/tools.md`, and `plugins/aidd-context/hooks/memory.cjs`.

## Test Scope

Detection positive/negative fixtures; Kilo sharing a memory target with other tools; repeated sync stability and preservation of user-authored sections. Current CI also exercises the native Kilo fixture suite. These tests do not prove every LLM-authored onboarding decision.

## Tasks to do

- Historical: add Kilo detection and memory routing; validate shared destination and preservation behavior. Reported complete in the old phase record.
- Current: retain only changes required to identify Kilo and route its project memory. Exclude broad memory refactors and unrelated hook/filesystem hardening.

## Test acceptance criteria

| Criterion | Current evidence/status |
| --- | --- |
| Kilo signals distinguish Kilo from `AGENTS.md`-only and OpenCode-only projects. | Detection fixtures and CI; see [verification](./verification.md). |
| Shared `AGENTS.md` is not duplicated and user content is preserved. | Memory sync tests and native fixture coverage. |
| Kilo project memory is discoverable by Kilo. | CI runtime evidence is fixture/provider scoped; no general LLM behavior claim. |
