---
name: 02-challenge
description: Rethink just-completed work against an agreed plan, classify findings as deal-breakers, suggestions, or correct, with a confidence score. Use to challenge a decision, criticize, or critically review recent work; not for line-by-line style review or writing code.
---

# Challenge

Rethink prior work and surface what is wrong, missing, or duplicated. Output a structured report with a confidence score so the user knows whether to ship, iterate, or rework.

## Actions

| #   | Action      | Role                                                          | Input                          |
| --- | ----------- | ------------------------------------------------------------- | ------------------------------ |
| 01  | `challenge` | Rethink prior work, classify findings, score confidence       | the work + agreed reference    |

## Default flow

Single action skill. The router dispatches to `challenge` whenever the trigger phrases above appear.

## Transversal rules

- Think in first principles. Every step must be logical, with no gap and no missing information.
- Challenge own assumptions and the user's decisions before declaring confidence.
- Look for edge cases, errors, inconsistencies, missing parts, duplications, and optimizations.
- Aim for simplifications. If the work can be smaller, say so.
- Output the structured report following `assets/report-template.md`, filled verbatim.

## References

- `references/confidence-rubric.md`: tiered rubric for the confidence percentage.

## Assets

- `assets/report-template.md`: findings report skeleton, filled per run.
