← [aidd-framework](../../../../README.md) / [aidd-ui](../../README.md)

# 03 - build

Turns the wireframes and design system into real interface code — the visual and interaction layer only. Delegated to the `ui-builder` agent.

## When to use

- The design system is set and the interface must be written.

## When NOT to use

- You want business logic, data, or architecture → that is the dev pipeline's concern.
- You want to define product or design → use [00-product](../00-product/README.md) or [02-design-system](../02-design-system/README.md).

## How to invoke

```
Use skill aidd-ui:03-build
```

## Outputs

- Hi-fi UI code for the scaffolded layer and each built screen.

## Prerequisites

- `DESIGN-SYSTEM.md` and the wireframes.

## Technical details

See [`SKILL.md`](SKILL.md).
