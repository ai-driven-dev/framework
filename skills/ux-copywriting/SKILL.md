---
name: ux-copywriting
description: >-
  Generates i18n-ready microcopy: voice & tone guidelines, error messages, empty states, tooltips, onboarding, CTAs.
  Use when you need consistent UX writing across the entire product.
---

# UX Copy

## Goal

Produce a complete UX copy document covering voice & tone guidelines, error messages, empty states, tooltips, onboarding copy, and CTAs. All copy is structured for i18n with translation keys and follows a consistent tone throughout the product.

## Rules

- All copy must be i18n-ready — every string MUST have a translation key, no exceptions
- Voice & tone must be defined before any copy is written
- Error messages must be actionable — tell the user what to do, not just what went wrong
- Empty states must guide the user toward the next action
- No placeholder copy — every string is production-ready
- Requirements started from $ARGUMENTS
- **Standalone usage** — when invoked directly (not through an agent), present the deliverable and ask for user approval

### Scope Boundary

**This deliverable is the single source of truth for ALL user-facing text** — error messages, empty states, tooltips, onboarding copy, CTAs, confirmation messages, notification text.

Do NOT copy text from `design_system.md`. Instead, use the design system for structural context (which components exist, which states they have) and write the definitive copy here.

## Quick Start

```text
Generate UX copy from our PRD and user flows
```

## Workflow

```mermaid
flowchart LR
    A[Read PRD + flows + DS] --> B[Define voice & tone] --> C[Error messages] --> D[Empty states] --> E[Tooltips & onboarding] --> F[CTAs] --> G[Challenge gate] --> H[Save ux_copy.md]
```

### Step 1: Define Voice & Tone

**Do:**

1. Read the template from Resources. Follow its exact structure — same headings, same table columns, same formats. Do not add, remove, or rename sections.
2. Read the PRD, user flows, and design system from $ARGUMENTS or referenced files
3. Define the product voice (personality traits: professional, friendly, technical, casual, etc.)
4. Define tone variations by context:
   - Success: celebratory but not excessive
   - Error: empathetic and actionable
   - Empty state: encouraging and guiding
   - Onboarding: welcoming and clear
5. Provide do/don't examples for each tone

**Success criteria:** Voice & tone guidelines defined with concrete examples

### Step 2: Error Messages & Empty States

**Do:**

1. For each error identified in the user flows, write:
   - A clear, non-technical error message
   - An actionable recovery instruction
   - The translation key (e.g., `error.auth.invalid_credentials`)
2. For each empty state identified in the user flows, write:
   - A contextual message explaining why it's empty
   - A CTA guiding the user to populate the state
   - The translation key (e.g., `empty.projects.no_projects`)

**Success criteria:** All errors and empty states have production-ready copy with i18n keys

### Step 3: Tooltips, Onboarding & CTAs

**Do:**

1. Write tooltips for complex UI elements (max 1 sentence each)
2. Write onboarding copy for first-time user experience:
   - Welcome message
   - Step-by-step guidance
   - Progressive disclosure copy
3. Write CTAs for all primary actions:
   - Use action verbs (Create, Save, Send, not OK/Submit)
   - Ensure consistency across similar actions
4. All strings with translation keys

**Success criteria:** Complete copy set with i18n keys for tooltips, onboarding, CTAs

### Step 4: Challenge Gate

**Do:**

1. Read the template from Resources
2. Verify every template section exists in the output with the exact same heading name and no section was added beyond what the template defines
3. Verify format requirements:
   - All strings have i18n translation keys per template key format

**Success criteria:** All template sections present and format requirements met. If any section is missing or any format is wrong, STOP — fix it. Do NOT proceed until structurally complete.

### Step 5: Save

**Do:**

1. Save as `{{DOCS}}/memory/internal/ux_copy.md`

**Success criteria:** File saved and accessible

## Resources

| Type     | Path                                          | Description          |
| -------- | --------------------------------------------- | -------------------- |
| Input    | `{{DOCS}}/memory/internal/prd.md`             | Product requirements |
| Input    | `{{DOCS}}/memory/internal/user_flows.md`      | User flows           |
| Input    | `{{DOCS}}/memory/internal/design_system.md`   | Design system        |
| Template | `{{DOCS}}/templates/ux/ux_copy.md`            | UX copy template     |
