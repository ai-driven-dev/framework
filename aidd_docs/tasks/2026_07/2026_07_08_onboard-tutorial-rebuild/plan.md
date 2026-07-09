---
objective: "onboard is rebuilt as a token-optimized guided tutorial over a granular, conditional-load file tree that teaches the AIDD flow, every current behavior preserved, and the skill-authoring contract updated to sanction the new structure."
status: pending
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Plan: Onboard tutorial rebuild

## Overview

| Field      | Value                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------- |
| **Goal**   | Turn onboard from a status dashboard into a didactic, token-lean tutorial teaching the AIDD flow. |
| **Source** | This conversation's agreed design; mockup gallery [`onboard-mockups.html`](./onboard-mockups.html) (colleague-approved). |

## Phases

| #   | Phase                              | File                         |
| --- | ---------------------------------- | ---------------------------- |
| 1   | Update the skill-authoring contract  | [`phase-1.md`](./phase-1.md) |
| 2   | Scan action + state refs             | [`phase-2.md`](./phase-2.md) |
| 3   | Assess + run actions (order/ + run/) | [`phase-3.md`](./phase-3.md) |
| 4   | Present action (tutorial render)     | [`phase-4.md`](./phase-4.md) |
| 5   | Router, description, docs, budget    | [`phase-5.md`](./phase-5.md) |

## Decisions

<!-- Architecture-magnitude only, one you'd regret reversing. -->

| Decision                                                                                     | Why                                                                                     |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Stay Markdown; no JSON/XML format swap                                                        | Measured (tiktoken): XML +16..29%, JSON content-dependent (+12% tabular). Format is a trap. |
| Two token surfaces: always-on = description only; everything else on-demand                  | The description loads for every skill each session; the body/refs load only when used.  |
| Split files only along conditional-load boundaries                                           | Split A from B only if a path needs A without B; co-loaded content stays one file.       |
| State-aware foundations order: existing repo => memory first (bootstrap skipped); greenfield => stack, memory, wire | Memory feeds on the project; empty repo has nothing to memorize, so the stack comes first. |
| Update `skill-generate/references/skill-authoring.md` to allow nested references             | The granular tree needs `references/state|order|run/`, which today's R3 forbids.         |
| Tutorial verbosity (banner, curriculum) lives in on-demand assets/refs, never in SKILL.md    | Keeps the always-on and router surfaces lean while the tutorial stays rich.              |
| Four actions, one per responsibility and file group: scan (state/), assess (order/), present (assets/+flow), run (run/) | `[?]`/`back` re-renders via present without re-deciding, so present is a real boundary from assess. |
| Router format: tiny title, an arrow schema (`a → b ↺` pipeline) or "pick one" (menu), verb-led telegraphic `Does`; drop the intro, the `Input` column, and any invented frontmatter flag | The mode reads itself with no field to interpret; official frontmatter keys only. |
