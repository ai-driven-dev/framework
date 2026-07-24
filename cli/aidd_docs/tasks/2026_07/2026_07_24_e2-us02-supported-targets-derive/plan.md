---
objective: "framework.ts's SUPPORTED_TARGETS list can no longer diverge from FRAMEWORK_BUILD_REGISTRY, the real routing source of truth."
status: implemented
---

# Plan: US-E2-02 — SUPPORTED_TARGETS derives from the build registry

## Overview

| Field      | Value                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------ |
| **Goal**   | Replace `framework.ts`'s hand-copied 5-name target list with one derived from `deps.ts`'s `FRAMEWORK_BUILD_REGISTRY`. |
| **Source** | `aidd_docs/tasks/2026_07/2026_07_22_aidd-tool-contract-cartography/epic-E2-install-build-integrity.md` (US-E2-02) |

## Phases

| #   | Phase                                    | File                          |
| --- | ------------------------------------------- | ------------------------------ |
| 1   | Derive SUPPORTED_TARGETS from the registry  | [`phase-1.md`](./phase-1.md) |

## Feasibility check (read before planning, not assumed)

`framework.ts` already has TWO validation layers, not one:
1. `SUPPORTED_TARGETS` (hand-copied `["claude","cursor","copilot","codex","opencode"]`, `framework.ts:11`) — validates `--target` alone, before mode is known. **This is the only hand-copied list; it's what the ticket targets.**
2. `createFrameworkBuildUseCase(deps, {target, mode, ...})` returning `undefined` when the `target:mode` pair isn't a `FRAMEWORK_BUILD_REGISTRY` key (`framework.ts:57-63`) — **already correctly derives from the registry today**, no change needed here.

`FRAMEWORK_BUILD_REGISTRY` (`deps.ts:240-337`) has 9 keys (`"claude:marketplace"`, `"claude:flat"`, ... `"opencode:flat"`), 5 unique target names — exactly matching `SUPPORTED_TARGETS` today. No current drift; the ticket is about preventing *future* drift when a target/mode pair is added or removed.

## Decisions

| Decision | Why |
| -------- | --- |
| Export a derived `SUPPORTED_BUILD_TARGETS` constant from `deps.ts` (computed once from `FRAMEWORK_BUILD_REGISTRY`'s keys), import it in `framework.ts` instead of the hand-copied array | `FRAMEWORK_BUILD_REGISTRY` is already private to `deps.ts`; exporting the whole registry would leak the internal factory-function shape into the command layer for no reason. A derived, typed, read-only target list is the minimal surface `framework.ts` actually needs. |
