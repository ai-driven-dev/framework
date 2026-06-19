---
name: 09-mermaid
description: Generate a valid, high-quality Mermaid diagram from a written source through a plan, confirm, generate, review loop. Use when the user wants to turn an architecture, lifecycle, or flow description into a Mermaid diagram, or when another skill needs one. Not for other diagram formats like PlantUML or Graphviz, or for rendering a diagram to an image.
---

# Mermaid

Produces a valid, structured Mermaid diagram from a written source by planning it, confirming the plan, generating, and offering a review.

## Actions

| #   | Action    | Role                                                    | Input            |
| --- | --------- | ------------------------------------------------------ | ---------------- |
| 01  | `mermaid` | Plan, confirm, generate, and review one diagram         | a written source |

Run action `01` and run its `## Test` before trusting the result.

## Transversal rules

- Plan before generating, and confirm the plan with the user. Block on the answer.
- Generate only what the confirmed plan holds. Never add a node or a relationship the user did not confirm.
- Follow the project's Mermaid conventions for every diagram.
- Output the diagram as a fenced block, never describe it in prose.

## References

- `references/mermaid-conventions.md`: the conventions and defaults every generated diagram follows.
