---
name: 02-design-system
description: Set the visual direction (brand board), then the tokens and component inventory, into BRAND-BOARD.md and DESIGN-SYSTEM.md. Use after wireframes are fixed, before building. Do NOT use to write UI code (that is build) or to define the product (that is product).
argument-hint: brand-board | tokens | components | system-doc
requires: PRODUCT.md + wireframes
next: 03-build
produces: BRAND-BOARD.md, DESIGN-SYSTEM.md
---

# Skill: design-system

The visual-foundation section of the UI recipe. Set the direction, then formalise it into tokens and components the build consumes.

## Recipe

Run the steps in order, `01 → 04`. The brand board comes first — direction before tokens. **Exit gate:** `product-critic` validates `BRAND-BOARD.md` and `DESIGN-SYSTEM.md` against `PRODUCT.md`; it does not advance to `03-build` until they pass.

## Actions

| #   | Action        | Role                                                  | Input                  |
| --- | ------------- | ----------------------------------------------------- | ---------------------- |
| 01  | `brand-board` | Set the visual direction: palette, type, tone, imagery | `PRODUCT.md`           |
| 02  | `tokens`      | Define design tokens from the direction               | brand board            |
| 03  | `components`  | Inventory the components and their states             | tokens + wireframes    |
| 04  | `system-doc`  | Assemble tokens and components into `DESIGN-SYSTEM.md` | tokens + components     |

## Assets

- `assets/BRAND-BOARD.md`: the brand-board scaffold, copied to the repo root and filled in.
- `assets/DESIGN-SYSTEM.md`: the design-system scaffold, copied to the repo root and filled in.
