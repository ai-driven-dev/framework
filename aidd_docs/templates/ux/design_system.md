---
name: design_system
description: Design system template — visual patterns, tokens, components, layouts
argument-hint: N/A
---

# Design System - [Project Name]

## Scope

**This document owns**: visual tokens, component patterns, variant specs, state structures, layout definitions, navigation patterns, wireframes.

**Out of scope** (reference only):
- Exact user-facing text → See `ux_copy.md`
- Detailed ARIA roles, keyboard sequences, focus management → See `accessibility_spec.md`
- User flow diagrams and state transitions → See `user_flows.md`

## 1. Design Tokens

### Color Palette

| Token | Value | Usage | WCAG AA |
|-------|-------|-------|---------|
| `color.primary` | [hex] | Primary actions, links | [ratio on surface] |
| `color.surface` | [hex] | Backgrounds | — |
| `color.error` | [hex] | Error states | [ratio on surface] |
| `color.success` | [hex] | Success states | [ratio on surface] |

### Typography Scale

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `type.h1` | [size] | [weight] | Page titles |
| `type.body` | [size] | [weight] | Body text |
| `type.caption` | [size] | [weight] | Labels, hints |

### Spacing System

Base unit: [4px / 8px]. Scale: [4, 8, 12, 16, 24, 32, 48, 64].

### Other Tokens

- Border radius: [values]
- Shadows: [values]
- Transitions: [values]

## 2. Component Inventory

| Component | Category | Variants | States | Used in journeys |
|-----------|----------|----------|--------|-----------------|
| [Button] | Atom | Primary, Secondary, Ghost, Danger | Default, Hover, Active, Disabled, Loading | [List] |
| [Input] | Atom | Text, Password, Search | Default, Focus, Error, Disabled | [List] |

## 3. Component Specifications

### [Component Name]

**Variants**: [List]

**States**:
| State | Visual pattern | Notes |
|-------|---------------|-------|
| Default | [Structural description] | |
| Error | [Error banner with icon + message + action] | Exact text → `ux_copy.md` |
| Empty | [Placeholder illustration + message + CTA] | Exact text → `ux_copy.md` |
| Loading | [Skeleton / spinner] | |

**Accessibility**: Keyboard accessible — see `accessibility_spec.md` for full ARIA and keyboard specification.

## 4. Navigation Patterns

| Pattern | When to use | Responsive behavior |
|---------|------------|-------------------|
| [Sidebar / Top nav / Tabs] | [Context] | [Mobile adaptation] |

## 5. Wireframes

### [Screen Name]
[ASCII wireframe or description using only defined components and tokens]

- [ ] Uses only defined components
- [ ] Respects design tokens
- [ ] Covers happy path + empty state
- [ ] Shows responsive behavior
