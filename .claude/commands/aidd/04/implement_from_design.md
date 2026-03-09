---
name: 'aidd:04:implement_from_design'
description: 'Implement a frontend component from a Figma design with pixel-perfect accuracy.'
argument-hint: 'The Figma file URL and frame/component to implement.'
---

# Goal

Implement a frontend component matching the provided design specifications exactly:

```text
$ARGUMENTS
```

## Rules

- Use Figma MCP to read design specs (colors, spacing, typography, layout)
- Extract exact values from Figma - no approximations for colors, spacing, or font sizes
- Generated code MUST include a comment referencing the Figma frame/component name
- Follow existing project component patterns and naming conventions
- Use project's design system tokens when available (colors, spacing, typography)

## Steps

1. Read the Figma design specs using Figma MCP.
   1. Extract colors (exact hex/rgb values).
   2. Extract spacing (margins, paddings, gaps).
   3. Extract typography (font family, size, weight, line-height).
   4. Extract layout structure (flex, grid, positioning).
2. Identify existing project patterns.
   1. Check for design system tokens or theme configuration.
   2. Find similar components to follow the same structure.
3. Generate the component code.
   1. Match Figma specs exactly.
   2. Add Figma reference comment at the top of the component.
   3. Use project conventions for file structure and naming.
4. Validate the implementation.
   1. Compare generated code values against Figma specs.
   2. Ensure all design tokens are used where applicable.
