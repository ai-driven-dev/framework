---
name: design-system
description: >-
  Generates a design system with components, guidelines, and patterns from PRD user journeys.
  Use when you need to create UI/UX foundations for a new project.
---

# Design System

## Goal

Create a coherent and reusable set of UI/UX patterns, components, and guidelines based on the product's user journeys and personas.

## Rules

- Components must be derived from actual user journeys, not invented
- Accessibility WCAG AA is mandatory, not optional
- Reuse before creating: check if an existing component can be adapted
- Design tokens (colors, typography, spacing) must be defined before components
- Requirements started from $ARGUMENTS

## Quick Start

```text
Create a design system from our PRD
```

## Workflow

```mermaid
flowchart LR
    A[Read PRD] --> B[Map journeys to screens] --> C[Identify components] --> D[Define tokens] --> E[Document components] --> F[Navigation patterns] --> G[Wireframes] --> H[Review] --> I[Save design_system.md]
```

### Step 1: Map Journeys

**Do:**

1. Read the PRD and extract user journeys from $ARGUMENTS or referenced files
2. Map each journey to required screens and interactions
3. Identify recurring components across journeys (buttons, inputs, cards, tables, modals)

**Success criteria:** All journeys mapped to screens, recurring components identified

### Step 2: Define Design Tokens

**Do:**

1. Define design tokens:
   - Color palette (with WCAG AA contrast verification)
   - Typography scale (h1-h6, body, caption)
   - Spacing system (4px base grid)
   - Border radius, shadows, transitions

**Success criteria:** All tokens defined with accessibility compliance

### Step 3: Document Components

**Do:**

1. For each component, document:
   - Variants (primary, secondary, ghost, danger)
   - States (default, hover, active, disabled, loading, error)
   - Accessibility requirements (labels, keyboard nav, focus)
2. Define navigation patterns (sidebar, top nav, tabs, breadcrumbs)

**Success criteria:** Each component fully documented with variants, states, accessibility

### Step 4: Wireframes & Review

**Do:**

1. Create wireframes for key MVP screens (main view, critical form, empty state, error state)
2. Present for review
3. **WAIT FOR USER APPROVAL**
4. Save as `{{DOCS}}/memory/internal/design_system.md`

**Success criteria:** Wireframes created, design system validated and saved

## Resources

| Type  | Path                       | Description          |
| ----- | -------------------------- | -------------------- |
| Input | `{{DOCS}}/memory/internal/prd.md` | Product requirements |
