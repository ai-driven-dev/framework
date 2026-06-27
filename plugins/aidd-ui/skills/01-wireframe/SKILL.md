---
name: 01-wireframe
description: Map the information architecture and sketch each screen at low fidelity, before any visual design. Use after the product is defined, to fix structure and flow. Do NOT use to choose colors, type, or final copy (that is design-system and polish), and not to write code.
argument-hint: flows | wireframe
requires: PRODUCT.md
next: 02-design-system
produces: flows + low-fidelity screens
---

# Skill: wireframe

The structure section of the UI recipe. Fix the information architecture and each screen's layout at low fidelity — no styling, no final copy.

## Recipe

Run the steps in order, `01 → 02`. **Exit gate:** `product-critic` validates the flows and wireframes against `PRODUCT.md`; it does not advance to `02-design-system` until they pass.

## Actions

| #   | Action      | Role                                          | Input                  |
| --- | ----------- | --------------------------------------------- | ---------------------- |
| 01  | `flows`     | Map the screens and navigation (IA)           | `PRODUCT.md`           |
| 02  | `wireframe` | Sketch each screen as a low-fidelity layout   | the flows              |

## References

- `references/wireframe-conventions.md`: how to draw the ASCII wireframes.

## Assets

- `assets/wireframe-template.md`: the per-screen wireframe scaffold.
