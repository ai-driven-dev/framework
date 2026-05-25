# 01 - Mermaid

Produce a 100% valid, high-quality Mermaid diagram from a markdown document through a plan-confirm-generate-review loop.

## Inputs

```yaml
source: <markdown document to convert>
```

## Outputs

A Mermaid diagram fenced as ```mermaid + an optional review note. On first user message, the action prints the six numbered steps below as short bullets so the user knows what is coming.

```mermaid
<rendered diagram>
```

## Process

1. **Ask for the document to convert** when not already provided.
2. **Plan the diagram.** Analyze the source and write down a detailed plan identifying at least:
   - Components (main elements, logical groups; use colors).
   - Children and parent elements.
   - Directions and hierarchies.
   - Relationships (colors, connections, dependencies).
   - Notes and labels per element when needed.
3. **Confirm the plan.** Ask the user "Do you confirm the plan?" and wait for explicit confirmation.
4. **Generate** the 100% valid Mermaid diagram from the plan. Flow direction defaults to `LR`. Minimum Mermaid version 10.8.0. Apply the conventions in `@${CLAUDE_PLUGIN_ROOT}/skills/04-mermaid/references/mermaid-conventions.md`.
5. **Offer a review.** Ask the user "Do you want me to review it?" and wait for an answer.
6. **Review on confirm.** Check syntax, look for empty or misplaced nodes, suggest improvements. Do NOT add any extra elements that were not in the confirmed plan.

## Test

The generated block is fenced with ```mermaid, parses without error against Mermaid 10.8.0+, follows the conventions in `@${CLAUDE_PLUGIN_ROOT}/skills/04-mermaid/references/mermaid-conventions.md`, and contains no nodes or relationships absent from the user-confirmed plan.
