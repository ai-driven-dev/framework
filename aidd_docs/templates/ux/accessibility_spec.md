---
name: accessibility_spec
description: Accessibility specification template — ARIA, keyboard, focus, contrast
argument-hint: N/A
---

# Accessibility Specification - [Project Name]

## Scope

**This document owns**: ARIA roles and attributes, keyboard navigation sequences, focus management rules, contrast requirements, skip links, landmark navigation.

**Out of scope** (reference only):
- Visual tokens (hex values, spacing) → See `design_system.md` (reference tokens by name)
- Exact user-facing text for screen readers → See `ux_copy.md`

## 1. Standards

- **Minimum**: WCAG 2.1 AA
- **Target AAA where achievable**: [List components/criteria where AAA is feasible]

## 2. Component Specifications

### [Component Name]

**ARIA Roles & Attributes**:
| Attribute | Value | Notes |
|-----------|-------|-------|
| `role` | [role] | |
| `aria-label` | [See ux_copy.md key: ...] | |
| `aria-expanded` | [true/false] | [When applicable] |
| `aria-live` | [polite/assertive] | [For dynamic content] |

**Keyboard Navigation**:
| Key | Action |
|-----|--------|
| Tab | [Focus behavior] |
| Enter | [Activation behavior] |
| Escape | [Dismiss behavior] |
| Arrow keys | [Navigation within component] |
| Space | [Selection behavior] |

**Tab Sequence**: [Expected focus order within this component]

## 3. Focus Management

### Modal / Drawer
- Focus trap: Tab does not leave the overlay
- Focus restoration: on close, return focus to trigger element
- First focusable element receives focus on open

### Dynamic Content
- `aria-live="polite"` for non-urgent updates
- `aria-live="assertive"` for critical alerts
- Focus moves to new content for lazy-loaded items

### Skip Links & Landmarks
- "Skip to content" link at top of page
- Landmark roles: `banner`, `navigation`, `main`, `contentinfo`

## 4. Contrast Ratios

| Element | Foreground token | Background token | Required ratio | Verified |
|---------|-----------------|-----------------|---------------|----------|
| Body text | `color.text` | `color.surface` | ≥ 4.5:1 (AA) | [ ] |
| Large text | `color.text` | `color.surface` | ≥ 3:1 (AA) | [ ] |
| UI components | `color.primary` | `color.surface` | ≥ 3:1 (AA) | [ ] |

> Reference tokens by name from `design_system.md`. Do not redefine hex values here.

## 5. Exceptions & Known Limitations

| Limitation | Justification | Planned remediation |
|-----------|--------------|-------------------|
| [What] | [Why] | [When/how it will be fixed] |
