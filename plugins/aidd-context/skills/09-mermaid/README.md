← [framework](../../../../README.md) / [aidd-context](../../README.md)

# 09 - Mermaid

Generates a valid, high-quality Mermaid diagram from a written source through a plan, confirm, generate, review loop.

## When to use

- Turning a written description (architecture, lifecycle, flow) into a Mermaid diagram.
- Producing a diagram to embed in an `INSTALL.md`, a decision record, or a memory file.
- When another skill needs a diagram (for example `01-bootstrap` calls it).

## When not to use

- For other diagram formats (PlantUML, Graphviz, draw.io).
- To freehand a diagram without a written source to plan from.
- To render or export to an image. This skill produces fenced Mermaid text only.

## Flow

One action with a six-step loop: get the source, plan, confirm the plan, generate, offer a review, review on confirm. The diagram is generated only from the confirmed plan, and never adds an element the user did not confirm.

## Requires

A written source (a paragraph, a list, or a section) describing what to diagram.

## Details

See [`SKILL.md`](SKILL.md) for the contract, [`actions/01-mermaid.md`](actions/01-mermaid.md) for the process, and [`references/mermaid-conventions.md`](references/mermaid-conventions.md) for the conventions and defaults every diagram follows.
