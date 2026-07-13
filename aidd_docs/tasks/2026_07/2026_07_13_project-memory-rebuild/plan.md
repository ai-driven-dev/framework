---
objective: "02-project-memory is a three-action skill (scan, generate, sync) on the onboard anatomy, writing every core memory file flat and wiring the block into each chosen tool's context file, created when missing."
status: in-progress
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Plan: Rebuild 02-project-memory on the onboard anatomy

## Overview

| Field      | Value                                                                                  |
| ---------- | -------------------------------------------------------------------------------------- |
| **Goal**   | Collapse the five-action memory skill to three, token-lean, with forced flat paths and an independent review. |
| **Source** | Brainstorm this session, grounded in the onboard rebuild and the current skill's files. |

## Phases

| #   | Phase                       | File                         |
| --- | --------------------------- | ---------------------------- |
| 1   | Router and scan             | [`phase-1.md`](./phase-1.md) |
| 2   | Generate with forced paths  | [`phase-2.md`](./phase-2.md) |
| 3   | Sync that adapts            | [`phase-3.md`](./phase-3.md) |
| 4   | Cutover and headless verify | [`phase-4.md`](./phase-4.md) |

## Decisions

<!-- Architecture-magnitude only, one you'd regret reversing. Omit if none qualify. -->

| Decision                                                                 | Why                                                                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Three actions `scan → generate → sync`, linear, each idempotent          | Five actions were four trivial ones and a pipeline; onboard proved small SKILL.md plus small actions. |
| `sync` owns the tool context file: creates it when missing, then fills   | The user's "project-memory adapts" — no separate init skill; the config file's absence is not a veto once the tool is picked. |
| A forced template-to-path table, flat destinations only                  | Codex and Copilot nested core files into `core/` or `internal/`, demoting them out of the always-loaded tier. Make the path data, not inference. |
| Review is a fan-out to independent `aidd-dev:checker` subagents          | The user requires an independent review that works, not a self-check.                            |
| Review degrades to a fresh-context pass where the host has no subagents  | Same portability lesson as onboard's orphaned rule: a runtime capability the host lacks must have a stated fallback. |
| Merge tool detection and the context-file map into one `tools.md`        | Both are keyed by tool; one table inside the skill is DRY. Duplication with onboard stays, tables independent. |
| Memory templates under `assets/templates/` are untouched                 | They are user-facing content; telegraphing them degrades what the reader reads.                  |
| `update_memory.js` takes an optional picked-tool list, no-arg unchanged  | sync must fill only the tools the user picked; the same script also runs as an auto hook with no such context, so the tool list is optional and absence keeps today's fill-all-present behavior. |
| `skill-authoring.md` stays untouched on this branch                      | Same standing constraint as the onboard rework; the authoring contract is a separate ticket.     |
