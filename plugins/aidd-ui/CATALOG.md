# aidd-ui catalog

Auto-generated index of skills, agents, references and assets shipped by the `aidd-ui` plugin.

> This file is automatically updated by the `scripts/summarize-markdown.js` script.

## Table of Contents

- [`.claude-plugin`](#claude-plugin)
- [`agents`](#agents)
- [`skills`](#skills)
  - [`skills/00-product`](#skills00-product)
  - [`skills/01-wireframe`](#skills01-wireframe)
  - [`skills/02-design-system`](#skills02-design-system)
  - [`skills/03-build`](#skills03-build)
  - [`skills/04-review`](#skills04-review)
  - [`skills/05-polish`](#skills05-polish)

---

### `.claude-plugin`

| File |
|------|
| [plugin.json](.claude-plugin/plugin.json) |

### `agents`

| File | Description |
|------|---|
| [product-critic.md](agents/product-critic.md) | `The ruthless design director. Judges a product or design artifact against an impeccable bar and refuses anything tepid, derivative, or half-finished. Use as the exit gate of every aidd-ui section before advancing. Never builds, never softens its verdict to be liked.` |
| [ui-builder.md](agents/ui-builder.md) | `Builds and polishes the interface from the design system, one screen or component at a time. Use when a wireframe and a design system exist and the UI must be written or refined. Never defines the product, never sets the visual direction, never gates its own work.` |

### `skills`

#### `skills/00-product`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-init.md](skills/00-product/actions/01-init.md) | - |
| `actions` | [02-interview.md](skills/00-product/actions/02-interview.md) | - |
| `actions` | [03-define-good.md](skills/00-product/actions/03-define-good.md) | - |
| `assets` | [PRODUCT.md](skills/00-product/assets/PRODUCT.md) | - |
| `-` | [README.md](skills/00-product/README.md) | - |
| `-` | [SKILL.md](skills/00-product/SKILL.md) | `Define the product and what "good" means for it, by deep interview, into PRODUCT.md. Use to open the UI recipe, before any wireframe or design. Do NOT use to write a PRD or functional spec (that is the product-management concern), and not to write code.` |

#### `skills/01-wireframe`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-flows.md](skills/01-wireframe/actions/01-flows.md) | - |
| `actions` | [02-wireframe.md](skills/01-wireframe/actions/02-wireframe.md) | - |
| `assets` | [wireframe-template.md](skills/01-wireframe/assets/wireframe-template.md) | - |
| `-` | [README.md](skills/01-wireframe/README.md) | - |
| `references` | [wireframe-conventions.md](skills/01-wireframe/references/wireframe-conventions.md) | - |
| `-` | [SKILL.md](skills/01-wireframe/SKILL.md) | `Map the information architecture and sketch each screen at low fidelity, before any visual design. Use after the product is defined, to fix structure and flow. Do NOT use to choose colors, type, or final copy (that is design-system and polish), and not to write code.` |

#### `skills/02-design-system`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-brand-board.md](skills/02-design-system/actions/01-brand-board.md) | - |
| `actions` | [02-tokens.md](skills/02-design-system/actions/02-tokens.md) | - |
| `actions` | [03-components.md](skills/02-design-system/actions/03-components.md) | - |
| `actions` | [04-system-doc.md](skills/02-design-system/actions/04-system-doc.md) | - |
| `assets` | [BRAND-BOARD.md](skills/02-design-system/assets/BRAND-BOARD.md) | - |
| `assets` | [DESIGN-SYSTEM.md](skills/02-design-system/assets/DESIGN-SYSTEM.md) | - |
| `-` | [README.md](skills/02-design-system/README.md) | - |
| `-` | [SKILL.md](skills/02-design-system/SKILL.md) | `Set the visual direction (brand board), then the tokens and component inventory, into BRAND-BOARD.md and DESIGN-SYSTEM.md. Use after wireframes are fixed, before building. Do NOT use to write UI code (that is build) or to define the product (that is product).` |

#### `skills/03-build`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-scaffold.md](skills/03-build/actions/01-scaffold.md) | - |
| `actions` | [02-screen.md](skills/03-build/actions/02-screen.md) | - |
| `-` | [README.md](skills/03-build/README.md) | - |
| `-` | [SKILL.md](skills/03-build/SKILL.md) | `Build the hi-fi interface from the design system, one screen or component at a time, via the ui-builder agent. Use after the design system is set. Do NOT use to write business logic, data, or architecture (that is the dev concern), nor to define product or design.` |

#### `skills/04-review`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-heuristics.md](skills/04-review/actions/01-heuristics.md) | - |
| `actions` | [02-accessibility.md](skills/04-review/actions/02-accessibility.md) | - |
| `actions` | [03-responsive.md](skills/04-review/actions/03-responsive.md) | - |
| `actions` | [04-visual.md](skills/04-review/actions/04-visual.md) | - |
| `assets` | [review-report-template.md](skills/04-review/assets/review-report-template.md) | - |
| `-` | [README.md](skills/04-review/README.md) | - |
| `references` | [a11y-checklist.md](skills/04-review/references/a11y-checklist.md) | - |
| `references` | [ux-heuristics.md](skills/04-review/references/ux-heuristics.md) | - |
| `-` | [SKILL.md](skills/04-review/SKILL.md) | `Critique the built UI on four axes — heuristics, accessibility, responsive, visual — into one report, via the product-critic agent. Use after building, before polish. Do NOT use to fix the findings (that is build and polish) or to review non-UI code.` |

#### `skills/05-polish`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-states.md](skills/05-polish/actions/01-states.md) | - |
| `actions` | [02-motion.md](skills/05-polish/actions/02-motion.md) | - |
| `actions` | [03-copy.md](skills/05-polish/actions/03-copy.md) | - |
| `-` | [README.md](skills/05-polish/README.md) | - |
| `-` | [SKILL.md](skills/05-polish/SKILL.md) | `Finish the UI — empty/error/loading states, motion, and UX copy — via the ui-builder agent. Use as the last section of the recipe, after review. Do NOT use to restructure the UI or change the design system.` |

