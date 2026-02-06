---
name: generate_prd
description: Generate or update a PRD from a feature idea through systematic questioning
argument-hint: "new <feature>" or "update <prd-path> <changes>"
---

# Generate PRD - Product Requirements Document

## Goal

Transform a vague feature idea into a complete PRD, or update an existing PRD as the project evolves.

## Rules

- Ask 3-5 questions max per iteration
- Never assume technical solutions upfront
- Challenge user assumptions
- Cover all PRD sections before generating
- Use bullet points for clarity
- Track changes with version history

## Modes

### Mode Detection

Parse `$ARGUMENTS` to determine mode:

- `new <feature>` or just `<feature>` → **Create Mode**
- `update <prd-path>` or `update <prd-path> <changes>` → **Update Mode**

---

## UPDATE MODE

> When updating an existing PRD

### Step 1: Load & Analyze

1. Read the existing PRD file
2. Display current version and status
3. Ask user: "What needs to change?"
    - New requirements discovered?
    - Scope change?
    - Technical pivot?
    - Timeline adjustment?
    - Feature completed/removed?

### Step 2: Identify Impact

For each proposed change:

1. Which PRD sections are affected?
2. Are there cascading impacts? (e.g., scope change → timeline → resources)
3. Does this invalidate any existing decisions?

### Step 3: Update Sections

1. Update affected sections with new information
2. Mark changed sections with `<!-- Updated: YYYY-MM-DD -->`
3. Move deprecated items to "Change History" appendix
4. Update status field

### Step 4: Version & Save

1. Increment version number (e.g., v1.0 → v1.1)
2. Add entry to Change History:

    ```markdown
    ### Change History

    | Version | Date       | Changes              | Author |
    | ------- | ---------- | -------------------- | ------ |
    | v1.1    | YYYY-MM-DD | [Summary of changes] | [User] |
    ```

3. Save updated PRD

- **WAIT FOR USER APPROVAL** before saving

---

## CREATE MODE

> When creating a new PRD

## Steps

### Phase 1: Core Requirements

> Focus on understanding WHAT we're building

Iterate until clear:

1. **Core Functionality**: What does the feature do? Main actions?
2. **User Context**: Who uses it? When? Why?
3. **Edge Cases**: What could go wrong? Special scenarios?
4. **Constraints**: Technical, business, time limitations?

- **WAIT FOR USER APPROVAL** before Phase 2

### Phase 2: Business Context

> Focus on WHY we're building

Ask about:

1. **Problem Statement**: What pain point does this solve?
2. **Success Criteria**: How do we know it works?
3. **Target Users**: Primary and secondary personas
4. **Risks**: Technical, business, timeline risks
5. **Assumptions**: What are we assuming to be true?

- **WAIT FOR USER APPROVAL** before Phase 3

### Phase 3: Goals & Metrics

> Focus on measuring SUCCESS

Ask about:

1. **Business Goals**: Revenue, growth, acquisition targets?
2. **Technical Goals**: Performance, scalability, reliability?
3. **User Goals**: UX improvements, efficiency gains?
4. **KPIs**: How to measure each goal?

- **WAIT FOR USER APPROVAL** before Phase 4

### Phase 4: Technical Scope

> Focus on HOW we build

Ask about:

1. **Tech Stack**: Preferred technologies? Existing constraints?
2. **Integrations**: APIs, external services, data sources?
3. **Data Model**: Key entities and relationships?
4. **Non-Functional Requirements**: Performance, security, accessibility?

- **WAIT FOR USER APPROVAL** before Phase 5

### Phase 5: UX & Testing

> Focus on user experience and quality

Ask about:

1. **Key User Flows**: Main journeys through the feature?
2. **Design System**: Existing components? Visual requirements?
3. **Testing Strategy**: Coverage targets? Critical paths?
4. **Acceptance Criteria**: Definition of done?

- **WAIT FOR USER APPROVAL** before Phase 6

### Phase 6: Scope Boundaries (3 Tiers)

> Focus on what we're NOT building — structured in 3 tiers for clarity

Ask about and classify into 3 tiers:

1. **Tier 1 — MVP Scope**: What's included in the first release? (Must Have only)
2. **Tier 2 — Next Release**: What's explicitly deferred to V2? (Should Have + Could Have)
3. **Tier 3 — Never**: What will we never build? (Won't Have + Anti-patterns)

For each tier, ask:

- What features belong here?
- Why this tier? (business rationale)
- What's the trigger to promote Tier 2 → Tier 1? (metrics, user feedback, revenue target)

```markdown
| Feature | Tier | Rationale | Promotion Trigger |
|---------|------|-----------|-------------------|
| [feature] | 1-MVP / 2-Next / 3-Never | [why] | [metric or condition] |
```

- **WAIT FOR USER APPROVAL** before generating

### Phase 7: Generate PRD

After all phases approved, generate the complete PRD to: `{{DOCS}}/internal/product/PRD.md` using this template: @{{DOCS}}/templates/pm/prd.md

Fill all sections with gathered information. Mark any remaining unknowns as `[TBD]`.
