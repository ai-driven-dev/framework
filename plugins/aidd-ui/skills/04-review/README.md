← [aidd-framework](../../../../README.md) / [aidd-ui](../../README.md)

# 04 - review

Judges the built UI against the product's bar across four axes — heuristics, accessibility, responsive, visual — into one report. Read-only; it never patches. Owned by the `product-critic` agent.

## When to use

- A screen or flow is built and needs critique before polish.

## When NOT to use

- You want to fix the findings → route back to [03-build](../03-build/README.md) or on to [05-polish](../05-polish/README.md).
- You want to review non-UI code → use the dev pipeline's review.

## How to invoke

```
Use skill aidd-ui:04-review
```

## Outputs

- A review report with findings per axis and a gate verdict.

## Prerequisites

- A built UI and `DESIGN-SYSTEM.md`.

## Technical details

See [`SKILL.md`](SKILL.md), [`assets/review-report-template.md`](assets/review-report-template.md), and [`references/`](references/).
