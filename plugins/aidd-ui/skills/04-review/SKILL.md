---
name: 04-review
description: Critique the built UI on four axes — heuristics, accessibility, responsive, visual — into one report, via the product-critic agent. Use after building, before polish. Do NOT use to fix the findings (that is build and polish) or to review non-UI code.
argument-hint: heuristics | accessibility | responsive | visual
requires: built UI
next: 05-polish
produces: review report
---

# Skill: review

The critique section of the UI recipe. Judge the built interface against the product's bar and surface what blocks it — read-only, never patches.

## Recipe

Run the steps in order, `01 → 04`, then assemble one report. **Exit gate:** the `product-critic` agent owns the verdict; the recipe does not advance to `05-polish` until the report clears the bar (or its blockers are routed back to `03-build`).

## Actions

| #   | Action          | Role                                                | Input          |
| --- | --------------- | --------------------------------------------------- | -------------- |
| 01  | `heuristics`    | Hierarchy, cognitive load, UX heuristics            | built UI       |
| 02  | `accessibility` | WCAG / a11y conformance                             | built UI       |
| 03  | `responsive`    | Breakpoints and reflow                              | built UI       |
| 04  | `visual`        | Consistency against `DESIGN-SYSTEM.md`              | built UI + DS  |

## References

- `references/ux-heuristics.md`: the heuristics checklist for `01`.
- `references/a11y-checklist.md`: the accessibility checklist for `02`.

## Assets

- `assets/review-report-template.md`: the report scaffold the four axes fill.

## Agent

- `product-critic`: owns the critique and the gate verdict.
