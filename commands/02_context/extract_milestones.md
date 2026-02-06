---
name: extract_milestones
description: Split PRD into deliverable milestones with complexity analysis
argument-hint: PRD content or file path
---

# Extract Milestones

## Goal

Transform a validated PRD into 3-6 ordered, deliverable milestones with clear objectives, go/no-go decision points, and complexity analysis.

## Context

You are a Project Roadmap Architect specialized in PRD decomposition and milestone planning. You organize features into logical phases that deliver incremental value and enable continuous validation.

## Rules

- Each milestone = user value + validation criteria + go/no-go decision point
- 3-8 features per milestone maximum
- Maximum 60% "Must Have" milestones
- L/XL milestones must be split before proceeding
- Name milestones by USER VALUE, not technical tasks
- Ordered by dependencies and value delivery

## Input

```text
$ARGUMENTS
```

## Steps

### Step 1: Load PRD and User Stories

1. Read the following files:
   - **PRD**: `{{DOCS}}/internal/product/PRD.md` (or path from $ARGUMENTS)
   - **USER_STORIES**: `{{DOCS}}/internal/product/USER_STORIES.md` (if exists)

2. Extract from PRD:
   - Core Features (Section 4)
   - Goals & Objectives (Section 3)
   - Success Metrics (Section 8)
   - Dependencies and constraints

3. Extract from USER_STORIES (if available):
   - Epics and associated stories
   - MoSCoW priorities
   - Dependencies between stories

### Step 2: Generate Milestones Using COSTAR Prompt

Use the following structured prompt:

```markdown
**CONTEXT**
Tu es un Project Roadmap Architect expert en décomposition de PRD et planification de milestones. Tu organises les features en phases logiques qui délivrent de la valeur incrémentale et permettent une validation continue.

**OBJECTIVE**
Décompose le PRD en 3-6 milestones ordonnés. Chaque milestone doit :
1. Délivrer de la valeur utilisateur concrète
2. Avoir des critères de validation mesurables
3. Avoir un point de décision go/no-go
4. Être nommé par la valeur utilisateur (pas par la technique)
5. Contenir 3-8 features logiquement regroupées

**STYLE**
Document structuré avec tableau récapitulatif + détails par milestone.

**TONE**
Stratégique et orienté business. Focus sur la valeur délivrée à chaque étape.

**AUDIENCE**
Product Manager, stakeholders, et équipe de développement qui doivent comprendre la roadmap et les points de décision.

**RESPONSE FORMAT**

Pour chaque milestone, fournis :
- **ID**: M1, M2, M3, etc.
- **Name**: Nommé par valeur utilisateur (ex: "Secure User Authentication" pas "Setup OAuth Backend")
- **Objective**: Quelle valeur ce milestone délivre aux utilisateurs (1-2 phrases)
- **Deliverable**: Ce qui est livré concrètement (ex: "Users can register, login, and reset password")
- **Features Included**: Liste des features du PRD incluses (3-8 max)
- **Priority**: Must Have / Should Have / Could Have
- **Complexity**: XS / S / M / L / XL (effort estimation)
- **Go/No-Go Criteria**: Conditions pour passer au milestone suivant
- **Dependencies**: Milestones ou systèmes externes requis

**COMPLEXITY SCALE**

| Size | Description | Typical Duration | Team Size |
|------|-------------|------------------|-----------|
| **XS** | 1-2 features simples | 1-2 semaines | 2-3 devs |
| **S** | 3-4 features simples | 2-3 semaines | 3-4 devs |
| **M** | 4-6 features modérées | 1 mois | 4-5 devs |
| **L** | 6-8 features complexes | 1.5-2 mois | 5-6 devs |
| **XL** | >8 features ou très complexes | >2 mois | >6 devs |

⚠️ **Si milestone est L ou XL** → DOIT être découpé en 2+ milestones plus petits

**ORDERING RULES**

1. **Dependencies first**: Milestones avec dépendances techniques d'abord
2. **Value delivery**: Prioriser les milestones Must Have qui délivrent le plus de valeur
3. **Risk mitigation**: Milestones avec haut risque technique tôt dans la roadmap
4. **Incremental validation**: Chaque milestone doit permettre de valider des hypothèses

**INPUT DOCUMENTS**
[Insert PRD Core Features here]
[Insert Goals & Objectives here]
[Insert USER_STORIES Epics if available]

**CONSTRAINTS**
- 3-6 milestones TOTAL (ni trop granulaire, ni trop large)
- Maximum 60% de milestones "Must Have" (éviter trop de criticité)
- 3-8 features par milestone (si plus, découper)
- Milestones L/XL doivent être flaggés pour découpage
- Chaque milestone doit avoir critères go/no-go mesurables
```

### Step 3: Validate Milestone Quality

For each generated milestone, validate:

1. **User Value Focus**: Name reflects user value, not technical implementation
   - ✅ GOOD: "Secure User Authentication"
   - ❌ BAD: "Setup OAuth Backend"

2. **Feature Count**: 3-8 features per milestone
   - ❌ FAIL: <3 features → Too granular, merge with another milestone
   - ❌ FAIL: >8 features → Too large, split into 2 milestones
   - ✅ PASS: 3-8 features

3. **Complexity Check**: Milestones L/XL must be decomposed
   - ❌ FAIL: L or XL complexity → Flag for decomposition
   - ✅ PASS: XS/S/M complexity

4. **Must Have Ratio**: Maximum 60% "Must Have"
   - ❌ FAIL: >60% Must Have → Reduce scope, move some to Should Have
   - ✅ PASS: ≤60% Must Have

5. **Go/No-Go Criteria**: Each milestone has measurable validation criteria
   - ❌ FAIL: Vague criteria ("system works")
   - ✅ PASS: Specific, testable criteria ("100 users can register and login")

6. **Dependencies**: All dependencies are identified and ordered correctly
   - ❌ FAIL: Milestone M3 depends on M4 (circular dependency)
   - ✅ PASS: Dependencies flow forward (M1 → M2 → M3)

### Step 4: Challenge and Refine

Ask critical questions to identify gaps:

```markdown
**CHALLENGE QUESTIONS**

1. **Hidden Dependencies**:
   - Are there implicit dependencies not documented?
   - Does any milestone require external systems not yet available?

2. **Oversized Milestones**:
   - Can any L/XL milestone be split into smaller phases?
   - Are there features that can be moved to later milestones?

3. **Missing MVP Elements**:
   - Do the Must Have milestones cover the complete MVP?
   - Is there a clear path to first value delivery?

4. **Risk Analysis**:
   - Which milestones have the highest technical risk?
   - Should high-risk milestones be de-risked earlier?

5. **Validation Gaps**:
   - Can each go/no-go criteria be measured objectively?
   - Are there missing validation points?
```

### Step 5: Generate Milestone Roadmap

Create the milestone document using the template:

```markdown
# Product Milestones Roadmap

> Generated from PRD version X.X on [date]

## Roadmap Overview

| ID | Milestone Name | Priority | Complexity | Duration | Dependencies |
|----|----------------|----------|------------|----------|--------------|
| M1 | [User Value Name] | Must Have | M | 1 month | None |
| M2 | [User Value Name] | Must Have | S | 2 weeks | M1 |
| M3 | [User Value Name] | Should Have | M | 3 weeks | M1, M2 |
| ... | ... | ... | ... | ... | ... |

## Priority Distribution

- **Must Have**: X milestones (Y%)
- **Should Have**: X milestones (Y%)
- **Could Have**: X milestones (Y%)

⚠️ **Validation**: Must Have ≤ 60% ✅

---

## Milestone Breakdown

### M1: [Milestone Name]

**Objective**: [What this milestone delivers to users - 1-2 sentences]

**Deliverable**: [Concrete output - what users can do after this milestone]

**Priority**: Must Have

**Complexity**: M (Medium - 4-6 features, ~1 month)

**Features Included**:
1. [Feature 1 from PRD Section X.X]
2. [Feature 2 from PRD Section X.X]
3. [Feature 3 from PRD Section X.X]
4. [Feature 4 from PRD Section X.X]

**Success Metrics**:
- [Metric 1]: [Target value]
- [Metric 2]: [Target value]

**Go/No-Go Decision Criteria**:
- ✅ [Criterion 1 - measurable]
- ✅ [Criterion 2 - measurable]
- ✅ [Criterion 3 - measurable]

**Dependencies**:
- **Internal**: None (first milestone)
- **External**: [API X must be available]
- **Data**: [Migration Y must be complete]

**Risks**:
- **Technical**: [Risk description + mitigation]
- **Business**: [Risk description + mitigation]

---

[Repeat for each milestone]

---

## Roadmap Timeline (Indicative)

```
Month 1-2: M1 (Must Have) → Go/No-Go Decision
Month 3-4: M2 (Must Have) → Go/No-Go Decision
Month 5-6: M3 (Should Have) → Go/No-Go Decision
Month 7: M4 (Could Have) → Final Release
```

## Critical Path

- **MVP Complete**: After M2 (end of Month 4)
- **First Value Delivery**: After M1 (end of Month 2)
- **Full Feature Set**: After M4 (end of Month 7)

## Flagged for Review

### Milestones Requiring Decomposition

| Milestone | Reason | Action |
|-----------|--------|--------|
| M5 | Complexity XL (12 features) | Split into M5a and M5b |

### High-Risk Milestones

| Milestone | Risk | Mitigation Plan |
|-----------|------|-----------------|
| M2 | External API dependency | Early spike to validate API availability |
```

### Step 6: Save and Report

1. Save milestones to: `{{DOCS}}/internal/product/MILESTONES.md` using template: @{{DOCS}}/templates/pm/milestones.md
2. Display summary:

```
✅ Milestones Extraction Complete

📊 Roadmap Summary:
- Total Milestones: X
- Must Have: X (Y%)
- Should Have: X (Y%)
- Could Have: X (Y%)

⚠️ Attention Required:
- X milestones flagged for decomposition (L/XL complexity)
- X high-risk milestones (mitigation plan required)

📁 Output: {{DOCS}}/internal/product/MILESTONES.md

➡️ Next Steps:
1. Review milestones flagged for decomposition
2. Validate go/no-go criteria are measurable
3. Continue to /prioritize_backlog for story-level planning
```

- **WAIT FOR USER VALIDATION** before proceeding

## Output

- **File Created**: `{{DOCS}}/internal/product/MILESTONES.md`
- **Format**: Roadmap table + detailed milestone breakdown
- **Next Step**: Use `/prioritize_backlog` to estimate and prioritize stories within each milestone

## Quality Checklist

- [ ] 3-6 milestones total
- [ ] Each milestone has 3-8 features
- [ ] Maximum 60% "Must Have" milestones
- [ ] No L/XL milestones (or flagged for decomposition)
- [ ] All milestones named by user value (not technical tasks)
- [ ] Each milestone has clear objective and deliverable
- [ ] Go/No-Go criteria are measurable and specific
- [ ] Dependencies are identified and ordered correctly
- [ ] Success metrics are defined for each milestone
- [ ] Risks are identified with mitigation plans

## Notes

- Milestones provide the **strategic roadmap**
- User stories (from `/generate_backlog_initial`) provide the **tactical execution plan**
- Go/No-Go decision points enable **iterative validation and course correction**
- Next phase: `/prioritize_backlog` and `/refine_user_stories` for implementation readiness
