---
name: prioritize_backlog
description: Prioritize (MoSCoW) and estimate (Fibonacci) user stories with dependencies and assumptions
argument-hint: USER_STORIES file path or use default {{DOCS}}/internal/product/USER_STORIES_INITIAL.md
---

# Prioritize and Estimate Product Backlog

## Goal

Apply MoSCoW prioritization and Fibonacci estimation to the initial backlog, identify dependencies, document assumptions and unknowns to prepare stories for implementation.

## Context

You are an Agile Product Owner expert in backlog prioritization and estimation. You work with the development team to classify stories by business value (MoSCoW) and estimate complexity (Fibonacci Story Points) through comparative analysis.

## Rules

- **MoSCoW First**: Prioritize before estimating (priority influences estimation effort)
- **Comparative Estimation**: Use Fibonacci sequence (1, 2, 3, 5, 8, 13, 21) and compare with reference stories
- **Document Assumptions**: Every estimate must include rationale and confidence level
- **Identify Blockers**: Surface dependencies and risks early
- **Flag Large Stories**: Stories ≥13 points need decomposition (handled in refine phase)

## Input

```text
$ARGUMENTS
```

## Steps

### Step 1: Load Backlog and Reference Data

1. Read the initial backlog:
   - **USER_STORIES_INITIAL.md**: `{{DOCS}}/internal/product/USER_STORIES_INITIAL.md` (or path from $ARGUMENTS)

2. Check for reference stories (optional but recommended):
   - Look for `{{DOCS}}/internal/product/reference_stories.csv` or `.md`
   - If not exists, offer to generate reference stories based on common patterns

3. Read PRD for context:
   - **PRD**: `{{DOCS}}/internal/product/PRD.md`
   - Extract: Tech Stack, Dependencies, Constraints, Non-Functional Requirements

### Step 2: Apply MoSCoW Prioritization Using COSTAR

Use the following structured prompt:

```markdown
**CONTEXT**
Tu es un Product Owner Agile expert en priorisation de backlog. Tu travailles avec une équipe Scrum pour classifier les User Stories selon leur criticité pour le MVP et leur valeur métier.

**OBJECTIVE**
Catégorise chaque User Story selon le framework MoSCoW (Must Have / Should Have / Could Have / Won't Have). Fournis une justification claire basée sur la valeur métier, les dépendances techniques, et la criticité MVP.

**STYLE**
Tableau Markdown avec colonnes : Story ID, Story Title, Priority, Rationale (1-2 phrases).

**TONE**
Pragmatique et orienté business. Focus sur la valeur délivrée et les risques de ne pas implémenter.

**AUDIENCE**
L'équipe Scrum et les parties prenantes qui doivent comprendre pourquoi chaque story a cette priorité.

**RESPONSE FORMAT**
Pour chaque User Story, fournis :
- **Priority**: Must Have / Should Have / Could Have / Won't Have
- **Rationale**: Justification en 1-2 phrases
  - Must Have : "Sans cette feature, le produit n'a aucune valeur" (ex: authentification)
  - Should Have : "Apporte beaucoup de valeur, mais MVP viable sans elle" (ex: notifications email)
  - Could Have : "Amélioration confort, pas critique" (ex: dark mode)
  - Won't Have : "Explicitement exclu de cette release" (ex: intégration mobile)

**INPUT**
[Insert USER_STORIES_INITIAL.md content here]
[Insert PRD Goals & Objectives here]
[Insert PRD Success Criteria here]

**CONSTRAINTS**
- Maximum 60% de stories "Must Have" (éviter trop de criticité)
- Toutes les "Must Have" doivent être nécessaires pour l'MVP minimal
- "Won't Have" doit être documenté pour gérer les attentes
```

### Step 3: Estimate with Fibonacci Story Points Using COSTAR

Use the following structured prompt:

```markdown
**CONTEXT**
Tu es un Scrum Master / Tech Lead expert en estimation Agile. Tu utilises la suite de Fibonacci (1, 2, 3, 5, 8, 13, 21) pour estimer la complexité relative des User Stories par comparaison avec des stories de référence.

**OBJECTIVE**
Estime chaque User Story en Story Points (Fibonacci) en la comparant avec des stories similaires déjà estimées. Documente les assumptions qui influencent l'estimation et le niveau de confiance.

**STYLE**
Tableau Markdown avec colonnes : Story ID, Story Points, Reference Story (comparaison), Estimation Basis (assumptions), Confidence.

**TONE**
Technique et précis. Explicite les facteurs de complexité : intégrations, dépendances, incertitude technique.

**AUDIENCE**
L'équipe de développement qui doit estimer et implémenter ces stories.

**RESPONSE FORMAT**
Pour chaque User Story, fournis :
- **Story Points**: 1 / 2 / 3 / 5 / 8 / 13 / 21 (Fibonacci)
- **Reference Story**: "Similar to [Story X] which was Y points" (si reference_stories disponible)
- **Estimation Basis** (assumptions table):
  | Assumption | Confidence | Impact if wrong |
  |-----------|------------|-----------------|
  | [ex: OAuth library handles token refresh] | High / Medium / Low | [ex: +3 points (manual refresh logic)] |
- **Complexity Factors**: Liste des facteurs qui augmentent la complexité (intégrations, données, UI complexe, etc.)

**FIBONACCI SCALE REFERENCE**
| Story Points | Signification | Exemple |
|-------------|---------------|---------|
| **1** | Trivial, <1h | Corriger un label, changer une couleur |
| **2** | Simple, <1 jour | Ajouter un champ à un formulaire existant |
| **3** | Standard, 1-2 jours | Créer un endpoint REST CRUD simple |
| **5** | Modéré, 3-4 jours | Authentification email/password avec validation |
| **8** | Complexe, 1 semaine | Dashboard avec 3 widgets et appels API |
| **13** | Très complexe, >1 semaine | Système de notifications push multi-canaux |
| **21** | Trop gros, MUST découper | Feature complète (décomposer en plusieurs stories) |

**INPUT**
[Insert USER_STORIES_INITIAL.md content here]
[Insert reference_stories if available]
[Insert PRD Tech Stack + Dependencies here]

**CONSTRAINTS**
- Stories ≥13 points doivent être flaggées pour découpage (géré dans /refine_user_stories)
- Toujours comparer avec une story similaire si disponible
- Documenter les assumptions critiques (Confidence Low = risque)
```

### Step 4: Identify Dependencies and Constraints

For each story, analyze and document:

```markdown
**PROMPT FOR DEPENDENCIES**
Pour chaque User Story, identifie les dépendances et contraintes :

**Dependencies & Constraints Table Format**:
| Type | Item | Status | Risk |
|------|------|--------|------|
| **Blocks** | [Story ID que cette story bloque] | blocked / unblocked | high / medium / low |
| **Blocked by** | [Story ID qui bloque cette story] | blocking / resolved | high / medium / low |
| **Technical** | [API / service externe requis] | available / pending | high / medium / low |
| **Data** | [Source de données nécessaire] | ready / pending | high / medium / low |

**Analysis Questions**:
1. Cette story dépend-elle d'autres stories du backlog ? (Blocked by)
2. D'autres stories dépendent-elles de celle-ci ? (Blocks)
3. Y a-t-il des APIs externes / services tiers requis ? (Technical)
4. Y a-t-il des migrations de données / sources de données ? (Data)
5. Quel est le niveau de risque si une dépendance échoue ? (Risk: high/medium/low)
```

### Step 5: Document Known Unknowns

For stories with **Confidence Low** or **Risk High**, create a Known Unknowns section:

```markdown
**Known Unknowns**:
- [ ] [Unknown] — clarifier avec [stakeholder / équipe]
  - **Impact**: High / Medium / Low
  - **Action**: [Spike technique / Recherche / Meeting avec expert]

- [ ] [Technical spike needed] for [component]
  - **Timeboxed**: 1-2 jours
  - **Goal**: [Valider faisabilité / Mesurer performance / Explorer solution]

**Si Unknown a Impact High + Confidence Low** → Créer une story "Spike" (2-3 points, timeboxed).
```

### Step 6: Generate Updated Backlog

Update the USER_STORIES.md file with:

```markdown
# Product Backlog - Prioritized and Estimated

> Updated on [date] with MoSCoW prioritization and Fibonacci estimation

## Summary

| Priority | Count | Total Story Points |
|----------|-------|-------------------|
| Must Have | X | Y points |
| Should Have | X | Y points |
| Could Have | X | Y points |
| Won't Have | X | 0 points |
| **TOTAL** | **X stories** | **Y points** |

## Backlog by Priority

### Must Have (MVP Critical)

| ID | Epic | User Story | Story Points | Dependencies | Risk |
|----|------|------------|--------------|--------------|------|
| US-001 | [Epic] | [Story] | 5 | Blocked by US-003 | Medium |
| ... | ... | ... | ... | ... | ... |

### Should Have (High Value)

[Same table format]

### Could Have (Nice to Have)

[Same table format]

### Won't Have (Out of Scope)

[List with rationale]

---

## Detailed Stories

### US-001: [Story Title]

| Field | Value |
|-------|-------|
| **Epic** | [Epic name] |
| **Priority** | Must Have |
| **Rationale** | [1-2 sentences explaining why Must Have] |
| **Story Points** | 5 |
| **Reference Story** | Similar to [Story X] (3 points) but with additional API integration (+2) |
| **Status** | Ready for refinement |

**As a** [persona]
**I want** [action]
**So that** [benefit]

#### Dependencies & Constraints

| Type | Item | Status | Risk |
|------|------|--------|------|
| Blocked by | US-003 (Authentication) | blocking | high |
| Technical | Stripe API | available | low |

#### Estimation Basis

| Assumption | Confidence | Impact if wrong |
|-----------|------------|-----------------|
| Stripe API handles webhooks automatically | High | +2 points (manual webhook management) |
| No custom payment flow required | Medium | +5 points (complex UX) |

#### Known Unknowns

- [ ] Stripe rate limits for free tier — clarifier avec équipe DevOps
  - **Impact**: Medium
  - **Action**: Créer spike technique (2 points, 1 jour)

---

[Repeat for all stories]
```

### Step 7: Flag Stories for Decomposition

Identify stories that need to be broken down:

```markdown
## Stories Requiring Decomposition

| Story ID | Title | Points | Reason | Priority |
|----------|-------|--------|--------|----------|
| US-042 | [Story] | 13 | Too large for single sprint | Must Have |
| US-055 | [Story] | 21 | Epic-sized, multiple workflows | Should Have |

**Action**: These stories will be decomposed in `/refine_user_stories` phase.
```

### Step 8: Save and Report

1. Save updated backlog to: `{{DOCS}}/internal/product/USER_STORIES.md`
2. Display summary report:

```
✅ Prioritization & Estimation Complete

📊 Summary:
- Total Stories: X
- Must Have: X stories (Y points)
- Should Have: X stories (Y points)
- Could Have: X stories (Y points)
- Won't Have: X items (documented)

⚠️ Attention Required:
- X stories ≥13 points (need decomposition)
- X stories with High Risk dependencies
- X Known Unknowns requiring spikes

📁 Output: {{DOCS}}/internal/product/USER_STORIES.md

➡️ Next Steps:
1. Review stories flagged for decomposition
2. Run /refine_user_stories to add Gherkin criteria and validate INVEST
3. Run /extract_milestones to organize into deliverable phases
```

- **WAIT FOR USER VALIDATION** before proceeding

## Output

- **File Updated**: `{{DOCS}}/internal/product/USER_STORIES.md`
- **Additions**:
  - MoSCoW Priority + Rationale
  - Story Points (Fibonacci) + Reference Story
  - Estimation Basis (assumptions table)
  - Dependencies & Constraints
  - Known Unknowns
  - Flagged stories for decomposition

## Quality Checklist

- [ ] All stories have MoSCoW priority with rationale
- [ ] All stories have Fibonacci estimation (1-21)
- [ ] Stories ≥13 points are flagged for decomposition
- [ ] Estimation Basis documents key assumptions
- [ ] Confidence level is specified (High/Medium/Low)
- [ ] Dependencies are identified (Blocks, Blocked by, Technical, Data)
- [ ] Risk level is assessed (High/Medium/Low)
- [ ] Known Unknowns are documented with action plan
- [ ] Maximum 60% of stories are "Must Have"
- [ ] "Won't Have" items are explicitly documented

## Notes

- Reference stories can be generated from past sprints or common patterns
- Stories with Confidence Low should have spikes created
- Dependencies with Risk High should be addressed before Sprint Planning
- Next step: `/refine_user_stories` for Gherkin criteria and INVEST validation
