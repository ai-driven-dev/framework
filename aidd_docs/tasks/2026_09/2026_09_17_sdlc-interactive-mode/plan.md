---
objective: "The SDLC flow runs autonomously by default, stops at the contract, the spec, the plan and the verdict when asked, and pushes only once a verdict is clean."
status: implemented
---

# Plan: an interactive mode for the SDLC flow

## Overview

| Field      | Value                   |
| ---------- | ----------------------- |
| **Goal**   | give the SDLC flow a second mode that pauses where an artifact can still be corrected, and move the push behind the verdict |
| **Source** | [`brainstorm.md`](./brainstorm.md) |

## Phases

| #   | Phase        | File                         |
| --- | ------------ | ---------------------------- |
| 1   | the mode and its four pauses | [`phase-1.md`](./phase-1.md) |
| 2   | the push behind the verdict | [`phase-2.md`](./phase-2.md) |
| 3   | the documents that claim one mode | [`phase-3.md`](./phase-3.md) |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| The mode word is `interactive`, never `manual` | four places already carry that word, and the skill contract forbids a second home for one fact |
| The pauses are the orchestrator's own behavior, written once in its router | R9 and R17 of the skill contract; no called skill changes, and `aidd-dev:01-plan` already switches on the orchestrator's declared autonomy |
| A refusal at a pause is a finding | the check zone already routes a finding back to framing or delivery and re-enters; a refusal needs no second mechanism |
| The push belongs to the pull request skill | a request on a branch the remote lacks cannot exist, so that skill has always carried the precondition and no text held it |
