---
name: implementation_readiness
description: Validate that specification is complete and ready for development handoff
argument-hint: <path-to-prd> or use current docs/product/
model: sonnet
---

# Implementation Readiness

## Goal

Validate that the specification package (PRD, user stories, milestones) is complete, consistent and ready for development handoff.

## Rules

- Binary evaluation: each criterion is PASS or FAIL
- All blocking criteria must PASS for Go decision
- Important criteria: >80% must PASS
- Do NOT fix issues — flag them for resolution
- Reference specific sections/stories when flagging gaps

## Context

```text
$ARGUMENTS
```

## Steps

### Step 1: Load Specification Package

1. Read the following files (or from $ARGUMENTS path):
   - `docs/product/PRD.md`
   - `docs/product/USER_STORIES.md`
   - `docs/product/MILESTONES.md`
   - `docs/product/GAP_REPORT.md` (if exists)
2. Verify all files exist and are non-empty

### Step 2: Evaluate Blocking Criteria

For each criterion, evaluate PASS/FAIL with evidence:

1. **Problem clearly defined** — PRD has a specific, measurable problem statement
2. **Target users identified** — At least 1 persona with observed behaviors
3. **Core features specified** — Each feature has functional requirements
4. **Acceptance criteria defined** — Every user story has Gherkin criteria
5. **Out of scope explicit** — Clear boundaries on what is NOT being built
6. **No critical gaps open** — Gap report shows 0 unresolved critical gaps
7. **Success metrics defined** — At least 1 measurable KPI per business goal

### Step 3: Evaluate Important Criteria

1. **NFRs specified** — Performance, security, usability requirements defined
2. **Dependencies identified** — External systems, APIs, data sources listed
3. **Milestones ordered** — Clear sequence with go/no-go between phases
4. **Stories estimated** — Story points assigned (Fibonacci)
5. **MoSCoW applied** — Each story classified Must/Should/Could/Won't
6. **Technical architecture outlined** — Tech stack and data model described
7. **Testing strategy defined** — Coverage targets and critical paths listed
8. **Risks documented** — At least technical and business risks with mitigation

### Step 4: Generate Readiness Report

1. Generate report using template: @{{DOCS}}/templates/pm/implementation_readiness.md
2. Calculate scores:
   - Blocking: X/7 PASS (must be 7/7)
   - Important: X/8 PASS (must be >80% = 7/8+)
3. Determine decision: **GO** / **NO-GO** / **CONDITIONAL GO**
4. List remediation actions for any FAIL criteria
5. Save to `docs/product/IMPLEMENTATION_READINESS.md`

- **WAIT FOR USER APPROVAL** before declaring readiness
