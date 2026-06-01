← [aidd-framework](../../../../README.md) / [aidd-context](../../README.md)

# 04 - Mermaid

Generates a 100% valid, high-quality Mermaid diagram from a markdown source
through a structured plan-confirm-generate-review loop. Defaults to flow
direction `LR` and targets Mermaid 10.8.0+.

## When to use

- Turning a written description (architecture, lifecycle, flow) into a
  Mermaid diagram.
- Producing a diagram to embed in an `INSTALL.md`, ADR, or memory file.
- Invoked by other aidd-context skills that need a diagram (e.g.
  `01-bootstrap` calls this from action 04).

## When NOT to use

- For non-Mermaid diagram formats (PlantUML, Graphviz, draw.io).
- To freehand a diagram without a written source to plan from.
- To render or export a diagram to PNG/SVG - this skill produces fenced
  Mermaid text only.

## How to invoke

```
Use skill aidd-context:04-mermaid
```

The skill runs one action with a six-step loop:

1. Ask for the document to convert.
2. Plan the diagram (components, parents/children, directions, relations,
   labels).
3. Confirm the plan with the user.
4. Generate a 100% valid Mermaid diagram from the confirmed plan.
5. Offer a review.
6. Review on confirm: check syntax, empty/misplaced nodes, and suggest
   improvements without adding elements absent from the confirmed plan.

## Outputs

- A fenced ```mermaid block containing a syntactically valid diagram that
  parses against Mermaid 10.8.0+.
- An optional review note when the user accepts the review step.

## Prerequisites

- A markdown source (paragraph, list, or section) describing what to
  diagram.
- Awareness of the project's Mermaid conventions (see
  `references/mermaid-conventions.md`).

## Technical details

See [`SKILL.md`](SKILL.md) for the entry contract,
[`actions/01-mermaid.md`](actions/01-mermaid.md) for the full process,
and `references/mermaid-conventions.md` for the conventions enforced
during generation.
