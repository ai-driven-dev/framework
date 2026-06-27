---
name: 03-build
description: Build the hi-fi interface from the design system, one screen or component at a time, via the ui-builder agent. Use after the design system is set. Do NOT use to write business logic, data, or architecture (that is the dev concern), nor to define product or design.
argument-hint: scaffold | screen
requires: DESIGN-SYSTEM.md + wireframes
next: 04-review
produces: hi-fi UI code
---

# Skill: build

The execution section of the UI recipe. Turn the wireframes and design system into real interface code — the visual and interaction layer only.

## Recipe

Run the steps in order, `01 → 02`, delegating each to the `ui-builder` agent. **Exit gate:** `product-critic` validates the built UI against `PRODUCT.md` and `DESIGN-SYSTEM.md`; it does not advance to `04-review` until it passes.

## Actions

| #   | Action     | Role                                                 | Input                       |
| --- | ---------- | ---------------------------------------------------- | --------------------------- |
| 01  | `scaffold` | Set up the UI layer and shared components from tokens | `DESIGN-SYSTEM.md`          |
| 02  | `screen`   | Build a screen to hi-fi, pulling only defined tokens  | wireframe + design system   |

## Agent

- `ui-builder`: executes both steps. Pulls every value from the design system; invents no token off-book.
