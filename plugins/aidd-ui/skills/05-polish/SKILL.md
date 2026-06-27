---
name: 05-polish
description: Finish the UI — empty/error/loading states, motion, and UX copy — via the ui-builder agent. Use as the last section of the recipe, after review. Do NOT use to restructure the UI or change the design system.
argument-hint: states | motion | copy
requires: reviewed UI
next: "—"
produces: finished UI
---

# Skill: polish

The finishing section of the UI recipe. Take a reviewed UI from correct to impeccable: the states it forgot, the motion that makes it feel alive, the words that carry it.

## Recipe

Run the steps in order, `01 → 03`, delegating each to the `ui-builder` agent. **Exit gate:** `product-critic` gives the final verdict against `PRODUCT.md`. Passing it is the end of the recipe.

## Actions

| #   | Action   | Role                                                  | Input        |
| --- | -------- | ----------------------------------------------------- | ------------ |
| 01  | `states` | Empty, error, loading, and edge states                | reviewed UI  |
| 02  | `motion` | Micro-interactions and transitions                    | reviewed UI  |
| 03  | `copy`   | UX copy: labels, empty states, errors, microcopy      | reviewed UI  |

## Agent

- `ui-builder`: executes all three steps within the design system's motion and type tokens.
