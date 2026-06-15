---
name: 12-design-system
description: Initialize a project's design system through a guided, ordered playbook that routes each step to the right Impeccable command - register and color strategy, palette with accessibility validation, typography, spacing, elevation, motion, components, and the canonical DESIGN.md.
disable-model-invocation: true
---

# Skill: design-system

Guided onboarding for authoring a quality design system. It does NOT generate the system - the [Impeccable](https://impeccable.style) skill already does (palette, typography, tokens, `DESIGN.md`). It adds the missing piece: an ordered playbook that routes each step to the right Impeccable command. Impeccable executes; `DESIGN.md` stays the single source of truth.

## Transversal rules

- **One source of truth**: Impeccable's root `DESIGN.md` (+ `.impeccable/design.json`). Never write a competing design file or a copy. Point, never copy.
- **Impeccable is a declared external dependency** - naming its commands is allowed; if absent, the playbook guides install.
- Per-step criteria are inline checkboxes in the action (walked as an AI-driven todo). No assets - the skill keeps no derived copy of `DESIGN.md`.
- English-only.

## Available actions

| #   | Action                 | Role                                                        | Input              |
| --- | ---------------------- | ---------------------------------------------------------- | ------------------ |
| 01  | `create-design-system` | Walk the playbook to a quality design system via Impeccable | project (optional) |
| 02  | `redesign-page`        | Critique → fix weak axes → loop until the score holds       | page (required)    |

## Default flow

`01` founds the system (run once); `02` redesigns an existing page against it (run anytime, requires `DESIGN.md`). Both confirm Impeccable is available, then drive its commands.

Authoring **new** page code is not this skill's concern (Knowledge layer) - that happens at implementation time, where the implementer delegates the presentational layer to Impeccable against this `DESIGN.md`. Redesigning an **existing** page's visual (action 02) is routing, not authoring: Impeccable executes, this skill orders the loop.
