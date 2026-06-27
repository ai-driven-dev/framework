← [aidd-framework](../../README.md)

# aidd-ui 🚧 alpha

UI and UX concern for the AI-Driven Development framework.

> ⚠️ **ALPHA — NOT READY FOR USE.** `0.1.0-alpha.0`. This plugin ships the skeleton of the UI recipe; the action logic is stubbed and lands later. APIs, skills, and naming may change or be removed without notice.

> Status: alpha (experimental).

This plugin is in alpha. It lives on a dedicated branch off `next` and is registered with `recommended: false`, so it stays off the curated install path until it stabilises and graduates to `main`. Test it from a local checkout of this branch:

```
claude --plugin-dir plugins/aidd-ui          # zero-marketplace, session-scoped
# or, persistent:
/plugin marketplace add .                      # register this checkout as a local marketplace
/plugin install aidd-ui@aidd-framework
```

## The recipe

`aidd-ui` is one recipe to generate a high-quality UI top to bottom. Each skill is a section, each action a step. You run a section's steps in order; the `product-critic` agent gates the exit; you advance to the next section. No section is skippable on quality.

```
00-product  →  01-wireframe  →  02-design-system  →  03-build  →  04-review  →  05-polish
 PRODUCT.md       flows + lo-fi     BRAND-BOARD.md       hi-fi UI     critique      finition
                                    DESIGN-SYSTEM.md
```

Each `SKILL.md` declares what it `requires` (the artifact before it) and what comes `next`, so the recipe chains without a central orchestrator.

## Skills

| #  | Skill | Produces | Description |
| -- | ----- | -------- | ----------- |
| 00 | [product](skills/00-product/README.md) | `PRODUCT.md` | Define the product and what "good" means, by deep interview. |
| 01 | [wireframe](skills/01-wireframe/README.md) | flows + lo-fi screens | Map the IA and sketch each screen at low fidelity. |
| 02 | [design-system](skills/02-design-system/README.md) | `BRAND-BOARD.md`, `DESIGN-SYSTEM.md` | Set the visual direction, then tokens and components. |
| 03 | [build](skills/03-build/README.md) | hi-fi UI code | Build the interface from the design system. |
| 04 | [review](skills/04-review/README.md) | review report | Critique the UI: heuristics, a11y, responsive, visual. |
| 05 | [polish](skills/05-polish/README.md) | finished UI | States, motion, and UX copy. |

## Agents

| Agent | Role |
| ----- | ---- |
| `ui-builder` | Executes the build and polish steps. |
| `product-critic` | The ruthless design director. Gates every section; nothing tepid passes. |
