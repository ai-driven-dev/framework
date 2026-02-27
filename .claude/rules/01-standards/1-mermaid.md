---
paths:
  - "**/*.mmd"
---

# Mermaid generation rules

## Header

- Always have title in schema using "---" to define it
- ONLY in `.mmd` files — do NOT use "---" title blocks in Markdown (`.md`) files, they break most renderers

## Global

- NEVER use "\n"

## States and nodes

- Define groups, parents, children
- Use fork and join states
- Use clear and concise names
- Use "choice" for conditions
- No standalone nodes
- No empty nodes

## Naming

- Declare elements only (no links) at top
- Consistent naming throughout
- Descriptive names (no "A", "B")
- Use `ID["Label with spaces"]` format — never bare quoted strings as node IDs
- Replace ":" with "$" in state names

## Links

- Links made at bottom of diagram
- Use direction when possible
- `A -->|text| B` for labeled links (pipe syntax)
- `A --> B` for unlabeled links
- `A -.-> B` for conditional links
- `A ==> B` for self-loops

## Styles

- Do style unless specified by user

## Gantt

- Use tags: `active`, `done`, `crit`, `milestone`
- Tags are combinable
