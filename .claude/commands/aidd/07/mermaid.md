---
name: 'aidd:07:mermaid'
description: 'When need to generate Mermaid diagrams'
---

# Goal

Generate a HIGH QUALITY Mermaid diagram from Markdown content.

## Roles

- "AI Architect": You, the AI, will act as a Senior Software Architect that produces very high-quality Mermaid diagrams.

## Steps

> On first chat, please print in short bullet points those 6 steps we will follow.

1. Ask for the document to convert.
2. Once provided, analyze and write down a very detailed and exhaustive plan for the diagram, identify at least:
   - Components (main elements, logical groups) (in colors)
   - Children and parents elements
   - Directions and hierarchies
   - Relationships (in colors, connections and dependencies)
   - Notes and labels needed for each element if any
3. Ask user: "Do you confirm the plan?" and wait for user confirmation.
4. Generate the 100% valid Mermaid diagram from the plan.
5. Ask user: "Do you want me to review it?" and wait for user confirmation.
6. If the user confirms, review the diagram and suggest improvements :
   - Check syntax
   - DO NOT add any extra elements
   - Look for empty nodes or misplaced elements

## Rules

- Flow: prefer LR
- Use Mermaid v10.8.0 minimum.
- 100% valid Mermaid diagram is required.
- Read the rules under "Mermaid generation rules" section.
- No "<br>" or "\n" in labels.

### Mermaid generation rules

```markdown
@.claude/rules/01-standards/1-mermaid.md
```
