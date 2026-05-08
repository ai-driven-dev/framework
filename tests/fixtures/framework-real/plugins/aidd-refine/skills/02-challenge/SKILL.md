---
name: aidd-refine:02:challenge
description: Rethink prior work to verify correctness against an agreed plan, classifying findings as deal-breakers, suggestions, or correct, with a confidence score. Use when the user says "challenge this", "rethink your plan", "is this correct", "review my last decision", "challenge my decision", "challenge what you did", "is my decision right", "criticize this", "find flaws", or asks for a critical review of just-completed work. Do NOT use for line-by-line code review against a style guide, implementing features, writing tests, or generating new code.
---

# Challenge

Rethink prior work and surface what is wrong, missing, or duplicated. Output a structured report with a confidence score so the user knows whether to ship, iterate, or rework.

## Available actions

| #   | Action      | Role                                                          | Input                          |
| --- | ----------- | ------------------------------------------------------------- | ------------------------------ |
| 01  | `challenge` | Rethink prior work, classify findings, score confidence       | review_target + agreed_plan    |

## Default flow

Single action skill. The router dispatches to `challenge` whenever the trigger phrases above appear.

## Transversal rules

- Think in first principles. Every step must be logical, with no gap and no missing information.
- Challenge own assumptions and the user's decisions before declaring confidence.
- Look for edge cases, errors, inconsistencies, missing parts, duplications, and optimizations.
- Aim for simplifications. If the work can be smaller, say so.
- Output the structured report verbatim per the action's `## Outputs` block.

## References

- `references/confidence-rubric.md`: tiered rubric for the confidence percentage.

## Assets

- None.

## External data

- None.
