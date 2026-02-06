---
name: document_prototype
description: Generate PRD from validated prototype through reverse engineering (Reverse Flip approach)
argument-hint: 'prototype code or path'
---

# Document Prototype - Reverse Engineering to PRD

## Goal

Transform a validated prototype into a structured PRD through reverse engineering, following the "Reverse Flip" paradigm (build first, document later).

## When to use

- You have a validated prototype (Lovable, Bolt, Claude Artifacts, v0.dev)
- The prototype has been tested with real users
- You need to formalize what was built into a PRD
- You want to document **what works** rather than **what you imagine**

## Input requirements

Provide the following to the AI:

1. **Prototype code** (required)
    - Full source code from Lovable/Bolt export
    - OR Claude Artifacts code snapshot
    - OR v0.dev generated code

2. **User validation evidence** (required)
    - Screenshots of validated user flows
    - User feedback notes (what worked, what didn't)
    - Design decisions log (choices made and why)

3. **Discovery inputs** (if available, from @claire)
    - Brief (BRIEF.md)
    - Personas (PERSONAS.md)
    - JTBD (JTBD.md)

## Rules

- Document **what exists**, not what you wish existed
- Every feature must have been validated by users
- If something wasn't tested, mark it as `[Not validated]`
- Trace each feature back to user feedback
- Be honest about limitations and gaps

---

## Steps

### Step 1: Analyze prototype implementation

Read and analyze the prototype code to extract:

1. **Implemented features**
    - What actions can users perform?
    - What is the core functionality?
    - What edge cases are handled?

2. **Data model**
    - What entities exist? (User, Product, Order, etc.)
    - What are the relationships?
    - What fields are stored?

3. **User flows**
    - What are the main user journeys?
    - What are the entry points?
    - What are the success/error states?

4. **Technical stack**
    - What technologies are used?
    - What external APIs/services are integrated?
    - What libraries/frameworks are present?

5. **Non-functional aspects**
    - Authentication/authorization approach
    - Performance characteristics observed
    - Accessibility features implemented

---

### Step 2: Extract functional requirements from validation

For each feature identified in Step 1, document:

**Feature validation:**

- **What does it do?** (user action)
- **Who validated it?** (which persona/user)
- **How was it validated?** (feedback received)
- **What worked?** (positive feedback)
- **What didn't work?** (issues identified)

**User context:**

- **When do users need this?** (trigger/context)
- **Why is this valuable?** (benefit/outcome)
- **What alternatives were rejected?** (design decisions)

---

### Step 3: Generate PRD sections

Using template `@{{DOCS}}/templates/pm/prd.md`, fill the 10 sections based on reverse engineering:

#### Section 1: Executive Summary

- **Problem**: What pain point does this prototype solve? (from user feedback)
- **Solution**: What does the prototype do? (high-level)
- **Success Criteria**: What validation metrics were achieved? (user satisfaction, completion rate, etc.)

#### Section 2: Context

- **Target Users**: Which personas validated the prototype?
- **Assumptions**: What assumptions were proven/disproven during validation?
- **Risks**: What risks were identified during testing?
- **Constraints**: What technical/business constraints shaped the prototype?

#### Section 3: Goals & Objectives

- **Business Goals**: Why was this prototype built?
- **Technical Goals**: What technical capabilities were validated?
- **User Goals**: What user needs were addressed?

#### Section 4: Core Features

List each implemented feature with:

- **Feature name**
- **Description**: What it does
- **User Story**: "As [persona], I can [action] so that [benefit]"
- **Validation**: What feedback validated this feature
- **Priority**: Based on user feedback (Must-have vs Nice-to-have)

#### Section 5: Non-Functional Requirements

Document observed NFRs:

- **Performance**: Load times, response times observed
- **Security**: Authentication approach used
- **Usability**: UX feedback received
- **Accessibility**: Features implemented

#### Section 6: Technical Architecture

- **Tech Stack**: Technologies used in prototype
- **Data Model**: Entities and relationships implemented
- **Integrations**: External services/APIs used
- **Architecture Decisions**: Key technical choices made

#### Section 7: User Experience

- **Information Architecture**: How is content organized?
- **Key User Flows**: Main journeys implemented
- **Design System**: Components/patterns used
- **Validation**: UX feedback from testing

#### Section 8: Success Metrics

- **Business KPIs**: How to measure business success?
- **Technical KPIs**: How to measure technical quality?
- **User KPIs**: How to measure user satisfaction?
- **Baseline**: What metrics were achieved in prototype testing?

#### Section 9: Testing Strategy

- **What was tested**: User flows validated
- **What wasn't tested**: Gaps identified
- **Acceptance Criteria**: How do we know it works?
- **Edge Cases**: What scenarios need more testing?

#### Section 10: Out of Scope

- **Current Scope**: What the prototype explicitly does NOT do
- **Future Consideration**: Features discussed but not built
- **Never**: Features explicitly rejected

---

### Step 4: Add "invisibles"

The prototype shows what was built, but not what was intentionally excluded or what edge cases exist. Ask the AI to complete:

| Element                     | Action                                                                  |
| --------------------------- | ----------------------------------------------------------------------- |
| **Non-Goals**               | List what the prototype intentionally does NOT do                       |
| **Edge Cases**              | "List 10 edge cases not covered by the prototype"                       |
| **Error States**            | Document: API failures, timeouts, validation errors                     |
| **Dependencies**            | List: third-party services, data migrations, compatibility requirements |
| **Risk Mitigation**         | What could go wrong in production that wasn't tested?                   |
| **Security Considerations** | What security aspects need hardening for production?                    |

**Prompt to use:**

```text
Based on this prototype, identify:
1. 10 edge cases not yet handled
2. 5 error states that need better handling
3. Security risks to address before production
4. Dependencies that could cause issues
```

---

### Step 5: Validate traceability

Ensure every section traces back to evidence:

- [ ] Each **feature** links to **user feedback** that validated it
- [ ] Each **requirement** links to a **user need** (persona/JTBD)
- [ ] Each **technical decision** links to a **constraint** or **validation**
- [ ] **Out of Scope** items have **reasons** (why not built)

Mark any assumption that wasn't validated as `[Not validated - assumption]`.

---

### Phase 6: Generate PRD

After all phases approved, generate the complete PRD to: `{{DOCS}}/internal/product/PRD.md` using this template: @{{DOCS}}/templates/pm/prd.md

Fill all sections with gathered information. Mark any remaining unknowns as `[TBD]`.
