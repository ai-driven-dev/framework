---
name: master_plan
description: Parent plan template orchestrating multiple child plans with validation gates
argument-hint: N/A
---

<!--  AI INSTRUCTIONS ONLY -- Follow those rules, do not output them.

- ENGLISH ONLY
- Text is straight to the point, no emojis, no style, use bullet points.
- Replace placeholders (`{variables}`) with actual user inputs.
- Each child plan uses the standard `plan.md` template format.
- Execution is sequential: next child blocked until previous validated.
- Validation is manual via checkbox approval.
-->

# Master Plan: {title}

## Overview

- **Goal**: {one-line summary}
- **Risk Score**: {X}/10
- **Branch**: `{branch-prefix}/`

## Child Plans

| #   | Plan        | File            | Status  | Validated |
| --- | ----------- | --------------- | ------- | --------- |
| 1   | {plan-name} | `./*-part-1.md` | pending | [ ]       |
| 2   | {plan-name} | `./*-part-2.md` | blocked | [ ]       |

<!-- Status values: pending, in-progress, done, blocked -->
<!-- RULE: Plan N+1 blocked until Plan N checkbox checked -->

## Validation Protocol

1. Complete Plan 1, run its validations
2. [ ] Checkpoint 1: User confirms
3. Unblock Plan 2, repeat
4. [ ] Final: Integration test

## Estimations

- **Confidence**: {X}/10
- **Duration**: {estimate}
