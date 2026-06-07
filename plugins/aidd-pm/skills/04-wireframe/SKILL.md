---
name: 04-wireframe
description: Produce low-fidelity wireframes from a feature description, auto-loading a PRD from aidd_docs when one exists, validated with the user before save. Use when the user says "wireframe", "wireframes", "wireframe the feature", "screen layout", "low-fi mockup", "maquette fil de fer", or asks for the screens and navigation flow of a feature. Do NOT use for high-fidelity visual design, generating UI code, drafting a PRD, or writing a spec.
---

# Wireframe

Turns product requirements into low-fidelity wireframes: a screen inventory, ASCII layouts, and a navigation flow. Stays at the structure level; never visual design and never code.

## Available actions

| #   | Action      | Role                                                              | Input                                            |
| --- | ----------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| 01  | `wireframe` | Load context, clarify screens, copy template into aidd_docs, fill it, validate | feature_description, platform (optional) |

## Default flow

Single action skill. The router dispatches to `wireframe` whenever a wireframe-generation phrase appears.

## Transversal rules

- Low fidelity only. Describe layout and structure, never visual design (colors, typography, spacing).
- Never produce executable code. No HTML, CSS, JS, or component snippets; wireframes are read, not run.
- Auto-load related documents (PRD, user stories) from `aidd_docs/` when they exist and reuse the PRD `feature_name` so the wireframe sits next to it. A PRD is never required and the skill is callable at any stage, including legacy projects with no product docs; a wireframe can be produced from the feature description alone. Never invent intent; mark every gap as `TBD: <precise question>`.
- Confirm the screen inventory and screen types with the user before drawing any layout.
- Copy the template into the save path first, then fill that copy in place; keep scaffold and fill as distinct steps.
- Always wait for explicit user validation before treating the wireframe as final.
- Do not self-validate. The caller spawns a reviewer with `@assets/wireframe-validator.yml`; findings come back for the next revision.
- Save path: `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>-<feature_name>-wireframe.md`.
- Source of truth for structure: `@assets/wireframe-template.md`.

## References

- None.

## Assets

- `@assets/wireframe-template.md`: wireframe body template.
- `@assets/wireframe-validator.yml`: checklist a reviewer uses to validate a wireframe.

## External data

- None.
