---
name: refine_user_stories
description: Refine user stories with Gherkin acceptance criteria, INVEST validation, DoR checklist, and NFRs
argument-hint: USER_STORIES file path or use default {{DOCS}}/internal/product/USER_STORIES.md
---

# Refine User Stories for Implementation Readiness

## Goal

Transform prioritized and estimated stories into implementation-ready stories by adding:
- Gherkin acceptance criteria (Given-When-Then)
- INVEST validation
- Definition of Ready checklist
- Non-Functional Requirements (NFRs)
- Decomposition of oversized stories (≥13 points)

## Context

You are a Product Owner and QA expert specialized in acceptance criteria definition and story quality validation. You ensure every story is testable, complete, and ready for development teams to implement.

## Rules

- **Gherkin format**: All acceptance criteria in Given-When-Then structure
- **Testable**: Every scenario must be verifiable with tests
- **INVEST compliance**: All stories must pass 6 INVEST criteria
- **DoR complete**: Definition of Ready checklist must be 100% validated
- **NFRs measurable**: Performance, Security, Accessibility with concrete targets
- **Decompose large stories**: Stories ≥13 points must be split into <8 point stories

## Input

```text
$ARGUMENTS
```

## Steps

### Step 1: Load Prioritized Backlog

1. Read the prioritized backlog:
   - **USER_STORIES.md**: `{{DOCS}}/internal/product/USER_STORIES.md` (or path from $ARGUMENTS)

2. Verify required fields exist:
   - Priority (MoSCoW)
   - Story Points (Fibonacci)
   - Dependencies
   - Estimation Basis

3. Identify stories requiring attention:
   - Stories ≥13 points (need decomposition)
   - Stories without acceptance criteria
   - Stories with "Unknown" or "Risk: High"

### Step 2: Decompose Oversized Stories (≥13 Points)

For each story ≥13 points, apply decomposition techniques:

```markdown
**PROMPT FOR STORY DECOMPOSITION**

**CONTEXT**
Tu es un Product Owner Agile expert en décomposition de User Stories. Une story trop volumineuse (≥13 points) ne peut pas tenir dans un sprint. Tu dois la découper en stories atomiques (<8 points idéalement) tout en préservant la valeur utilisateur.

**OBJECTIVE**
Décompose la User Story [US-XXX] (actuellement [X] points) en stories plus petites (<8 points chacune). Utilise une des techniques de découpage suivantes :

**TECHNIQUES DE DÉCOUPAGE**

1. **Par Workflow (étapes du processus)**
   - Exemple: "Auto-prioritize tasks" (13 pts) →
     - US-042a "Calculate priority score" (5 pts)
     - US-042b "Display priority in UI" (3 pts)
     - US-042c "Allow manual override" (3 pts)

2. **Par Règle Métier (variantes de comportement)**
   - Exemple: "Smart prioritization" (13 pts) →
     - US-042a "Prioritize by deadline only" (5 pts)
     - US-042b "Prioritize by deadline + capacity" (8 pts)

3. **Par Données (CRUD operations)**
   - Exemple: "Task management" (13 pts) →
     - US-042a "Read task priorities" (2 pts)
     - US-042b "Update task priorities" (5 pts)
     - US-042c "Delete tasks" (3 pts)

4. **Par Interface (Frontend vs Backend)**
   - Exemple: "Priority system" (13 pts) →
     - US-042a "Backend: priority calculation API" (8 pts)
     - US-042b "Frontend: display priority badge" (3 pts)

**RESPONSE FORMAT**
Pour chaque sub-story créée, fournis :
- **Story ID**: US-XXXa, US-XXXb, etc.
- **Story**: Format "En tant que... je veux... afin de..."
- **Story Points**: Fibonacci (vérifier que total ≈ estimation originale)
- **Technique**: Quelle technique de découpage utilisée
- **Validation**: La story est-elle Small (critère INVEST) ?
```

**Validation après découpage**:
- [ ] Chaque sub-story est < 8 points
- [ ] Total des points ≈ estimation originale (±20%)
- [ ] Chaque sub-story apporte de la valeur utilisateur
- [ ] Les sub-stories peuvent être implémentées indépendamment

### Step 3: Generate Gherkin Acceptance Criteria

For each story, generate comprehensive acceptance criteria:

```markdown
**PROMPT FOR GHERKIN ACCEPTANCE CRITERIA**

**CONTEXT**
Tu es un QA Lead expert en rédaction de critères d'acceptation Gherkin (Given-When-Then). Tu transformes les User Stories en scénarios testables qui serviront de base pour les tests automatisés.

**OBJECTIVE**
Pour la User Story [US-XXX], génère des critères d'acceptation au format Gherkin couvrant :
1. **Happy Path** : Scénario principal (utilisateur réussit l'action)
2. **Error Scenarios** : Cas d'erreur (2-3 scénarios)
3. **Edge Cases** : Cas limites (valeurs extrêmes, états inhabituels)

**STYLE**
Format Gherkin strict : Given-When-Then. Chaque scénario doit être testable et vérifiable.

**TONE**
Précis et non ambigu. Utilise des valeurs concrètes (pas "beaucoup" mais "100 tasks").

**AUDIENCE**
Équipe QA et développeurs qui vont écrire les tests automatisés (unit, integration, E2E).

**RESPONSE FORMAT - GHERKIN STRUCTURE**

```gherkin
Scenario: [Description du scénario]
  Given [contexte initial / préconditions]
  And [contexte additionnel si nécessaire]
  When [action effectuée par l'utilisateur]
  Then [résultat attendu]
  And [vérification supplémentaire]
```

**EXAMPLE - HAPPY PATH**

```gherkin
Scenario: User successfully auto-prioritizes tasks
  Given I am logged in as a Team Manager
  And I have 10 tasks with different deadlines
  When I click "Auto-prioritize" button
  Then tasks are reordered by calculated priority score
  And highest priority task appears at the top
  And priority badge is visible on each task
  And I see a success message "Tasks prioritized successfully"
```

**EXAMPLE - ERROR SCENARIO**

```gherkin
Scenario: Auto-prioritize with no tasks
  Given I am logged in as a Team Manager
  And I have 0 tasks in my backlog
  When I click "Auto-prioritize" button
  Then I see an informational message "No tasks to prioritize"
  And the button is disabled
  And the task list remains empty
```

**EXAMPLE - EDGE CASE**

```gherkin
Scenario: Auto-prioritize with tasks having same deadline
  Given I am logged in as a Team Manager
  And I have 5 tasks all with deadline "2026-03-01"
  When I click "Auto-prioritize" button
  Then tasks are ordered by secondary criteria (creation date)
  And a tooltip explains "Same deadline - sorted by creation date"
```

**CONSTRAINTS**
- Minimum 1 Happy Path + 2 Error Scenarios per story
- Tous les scénarios doivent être testables automatiquement
- Pas de détails d'implémentation (pas "call API endpoint /tasks")
- Focus sur le comportement utilisateur observable
```

### Step 4: Validate INVEST Criteria

For each story, validate all 6 INVEST criteria:

```markdown
**INVEST VALIDATION CHECKLIST**

Run this validation for each story:

- [ ] **I**ndependent — Peut être développée sans dépendre d'autres stories
  - ❌ FAIL → Revoir Dependencies, découpler si possible
  - ✅ PASS → Continue

- [ ] **N**egotiable — Les détails peuvent être discutés (pas un contrat figé)
  - ❌ FAIL → Assouplir les critères, laisser flexibilité à l'équipe
  - ✅ PASS → Continue

- [ ] **V**aluable — Apporte de la valeur à l'utilisateur final
  - ❌ FAIL → Challenger : vraie valeur ? Peut-être Won't Have
  - ✅ PASS → Continue

- [ ] **E**stimable — L'équipe peut estimer l'effort (pas trop vague)
  - ❌ FAIL → Clarifier description, ajouter Known Unknowns, ou spike
  - ✅ PASS → Continue

- [ ] **S**mall — Tient dans un sprint (<8 points idéalement)
  - ❌ FAIL → Découper la story (voir Step 2)
  - ✅ PASS → Continue

- [ ] **T**estable — Les critères d'acceptation sont vérifiables
  - ❌ FAIL → Ajouter critères Gherkin mesurables (voir Step 3)
  - ✅ PASS → Story validated ✅

**AUTOMATED PROMPT FOR INVEST VALIDATION**

Pour chaque User Story, évalue les 6 critères INVEST et indique PASS/FAIL avec justification :

| Critère | Status | Justification / Action Corrective |
|---------|--------|----------------------------------|
| Independent | PASS/FAIL | [Si FAIL : quelle dépendance bloque ?] |
| Negotiable | PASS/FAIL | [Si FAIL : quel aspect est trop rigide ?] |
| Valuable | PASS/FAIL | [Si FAIL : quelle valeur manque ?] |
| Estimable | PASS/FAIL | [Si FAIL : quelle incertitude empêche l'estimation ?] |
| Small | PASS/FAIL | [Si FAIL : story points > 8, découper] |
| Testable | PASS/FAIL | [Si FAIL : critères Gherkin manquants ou ambigus] |

**Si un critère FAIL** : Proposer une action corrective avant de valider la story.
```

### Step 5: Define Non-Functional Requirements (NFRs)

For each story, add measurable NFRs:

```markdown
**PROMPT FOR NFRs**

Pour la User Story [US-XXX], définis les exigences non-fonctionnelles suivantes :

**Non-Functional Requirements Table**

| Category | Requirement | Success Criterion | Test Method |
|----------|-------------|-------------------|-------------|
| **Performance** | [Exigence] | [Cible mesurable] | [Comment mesurer] |
| **Security** | [Exigence] | [Cible mesurable] | [Comment vérifier] |
| **Accessibility** | [Exigence] | [Cible mesurable] | [Comment tester] |
| **Scalability** | [Exigence] | [Cible mesurable] | [Comment valider] |
| **Reliability** | [Exigence] | [Cible mesurable] | [Comment monitorer] |

**EXAMPLES**

| Category | Requirement | Success Criterion | Test Method |
|----------|-------------|-------------------|-------------|
| Performance | Task list loads fast with large dataset | p95 latency <2s with 1000 tasks | Lighthouse Performance, Load Testing |
| Security | Task data encrypted at rest | AES-256 encryption | Security Audit, Penetration Test |
| Accessibility | Keyboard navigation support | WCAG 2.1 AA compliant | axe DevTools, Manual Testing |
| Scalability | Support concurrent users | 100 concurrent users without degradation | Load Testing (JMeter) |
| Reliability | System uptime maintained | 99.9% uptime SLA | Monitoring (Datadog, New Relic) |

**CONSTRAINTS**
- Tous les critères doivent être mesurables (pas "rapide" mais "< 2s")
- Référencer les outils de mesure (Lighthouse, axe, JMeter, etc.)
- Priorité selon criticité MVP (Must Have → NFRs complets, Could Have → NFRs allégés)
```

### Step 6: Complete Definition of Ready (DoR)

For each story, validate DoR checklist:

```markdown
**DEFINITION OF READY CHECKLIST**

A story is ready for Sprint Planning when ALL criteria are met:

- [ ] **Acceptance criteria defined** — Critères Gherkin présents (Happy Path + Error Scenarios + Edge Cases)
- [ ] **Dependencies identified** — Dependencies & Constraints remplis (Blocks, Blocked by, Technical, Data)
- [ ] **Story points estimated** — Estimation Fibonacci avec Reference Story et Estimation Basis
- [ ] **No blocking questions** — Aucune Known Unknown critique sans réponse (ou spike créé)
- [ ] **INVEST validated** — Tous les 6 critères INVEST sont PASS
- [ ] **NFRs defined** — Performance, Security, Accessibility avec critères mesurables
- [ ] **Persona assigned** — Story associée à un persona du Discovery Package
- [ ] **PRD traceability** — Story trace vers une feature du PRD

**AUTOMATED DoR VALIDATION**

Pour chaque User Story, valide la DoR et indique le status :

| DoR Criterion | Status | Notes |
|--------------|--------|-------|
| Acceptance criteria | ✅ / ❌ | [Gherkin complet ?] |
| Dependencies | ✅ / ❌ | [Dépendances identifiées ?] |
| Story points | ✅ / ❌ | [Estimation avec rationale ?] |
| No blocking questions | ✅ / ❌ | [Unknown critiques résolus ?] |
| INVEST validated | ✅ / ❌ | [6 critères PASS ?] |
| NFRs defined | ✅ / ❌ | [NFRs mesurables ?] |
| Persona assigned | ✅ / ❌ | [Persona référencé ?] |
| PRD traceability | ✅ / ❌ | [Feature PRD mentionnée ?] |

**Result**: Story is **READY** / **NOT READY** for Sprint Planning.
```

### Step 7: Generate Refined Backlog

Update the USER_STORIES.md with all refinements:

```markdown
# Product Backlog - Implementation Ready

> Refined on [date] with Gherkin criteria, INVEST validation, DoR checklist, NFRs

## Readiness Summary

| Status | Count | Story Points |
|--------|-------|--------------|
| ✅ Ready | X | Y points |
| ⚠️ Needs Review | X | Y points |
| ❌ Blocked | X | Y points |

## Backlog by Epic

### Epic 1: [Epic Name]

---

#### US-001: [Story Title]

| Field | Value |
|-------|-------|
| **Epic** | [Epic name] |
| **Priority** | Must Have |
| **Story Points** | 5 |
| **Status** | ✅ Ready for Sprint Planning |

**As a** [persona]
**I want** [action]
**So that** [benefit]

##### Dependencies & Constraints

| Type | Item | Status | Risk |
|------|------|--------|------|
| Blocked by | US-003 | resolved | low |

##### Acceptance Criteria

###### Happy Path

```gherkin
Scenario: [Primary success scenario]
  Given [context]
  When [action]
  Then [result]
  And [verification]
```

###### Error Scenarios

```gherkin
Scenario: [Error case 1]
  Given [error context]
  When [error trigger]
  Then [graceful handling]

Scenario: [Error case 2]
  Given [edge case context]
  When [edge action]
  Then [expected behavior]
```

##### Non-Functional Requirements

| Category | Requirement | Success Criterion | Test Method |
|----------|-------------|-------------------|-------------|
| Performance | [Requirement] | [Measurable target] | [How to test] |
| Security | [Requirement] | [Measurable target] | [How to verify] |
| Accessibility | [Requirement] | [Measurable target] | [How to test] |

##### INVEST Checklist

- [x] **I**ndependent — can be developed without other stories
- [x] **N**egotiable — details can be discussed
- [x] **V**aluable — delivers value to the user
- [x] **E**stimable — team can estimate the effort
- [x] **S**mall — fits in a single sprint (<8 points)
- [x] **T**estable — acceptance criteria are verifiable

##### Definition of Ready

- [x] Acceptance criteria defined (Gherkin)
- [x] Dependencies identified
- [x] Story points estimated
- [x] No blocking questions
- [x] INVEST validated
- [x] NFRs defined
- [x] Persona assigned
- [x] PRD traceability

##### Estimation Basis

| Assumption | Confidence | Impact if wrong |
|-----------|------------|-----------------|
| [Assumption] | High | [Impact] |

##### Known Unknowns

- ✅ [Resolved unknown]
- ⚠️ [Pending spike: Spike-042 created]

---

[Repeat for all stories]
```

### Step 8: Fix & Flag (Direct Feedback)

For each story, apply corrections directly instead of generating a separate report:

1. **INVEST FAIL** → Fix the story immediately:
   - Not Independent → Decouple or document dependency clearly
   - Not Small → Decompose (Step 2)
   - Not Testable → Add Gherkin (Step 3)
   - Not Estimable → Add Known Unknowns or create spike

2. **Gherkin missing** → Generate acceptance criteria (Step 3)

3. **DoR incomplete** → Complete missing fields directly in the story

4. **NFRs missing** → Add measurable NFRs (Step 5)

5. **Unfixable issues** → Flag inline in the story with `⚠️ PM REVIEW`:

```markdown
> ⚠️ PM REVIEW: [description du problème — ex: "Valeur business non claire, story potentiellement Won't Have"]
```

### Step 9: Save and Report

1. Save refined backlog to: `{{DOCS}}/internal/product/USER_STORIES.md`
2. Display summary:

```text
✅ User Stories Refinement Complete

📊 Readiness Summary:
- ✅ Ready: X stories (Y points)
- ⚠️ Needs PM Review: X stories (Y points) — flagged inline
- ❌ Blocked: X stories (Y points)

📝 Corrections Applied:
- Gherkin acceptance criteria: X stories
- INVEST fixes: X stories corrected
- NFRs added: X stories
- DoR completed: X stories
- Stories decomposed: X → Y sub-stories

⚠️ Flagged for PM Review:
- US-XXX: [issue summary]
- US-YYY: [issue summary]

📁 Output: {{DOCS}}/internal/product/USER_STORIES.md

➡️ Next Step: Run /implementation_readiness to validate go/no-go decision
```

- **WAIT FOR USER VALIDATION** before proceeding

## Output

- **File Updated**: `{{DOCS}}/internal/product/USER_STORIES.md`
- **Corrections applied directly in stories**:
  - Acceptance Criteria (Gherkin format)
  - INVEST fixes (corrected, not just reported)
  - Definition of Ready (completed)
  - Non-Functional Requirements (measurable)
  - Sub-stories (for decomposed stories)
  - PM Review flags (for issues needing human decision)

## Quality Checklist

- [ ] All stories have Gherkin acceptance criteria (Happy Path + Errors + Edge)
- [ ] All stories pass 6 INVEST criteria
- [ ] All stories have complete DoR
- [ ] All stories have measurable NFRs
- [ ] Stories ≥13 points have been decomposed into <8 point stories
- [ ] All scenarios are testable (no ambiguity)
- [ ] Known Unknowns are resolved or have spikes created
- [ ] Blocked stories have action plan
- [ ] PM Review flags added for unfixable issues

## Notes

- Gherkin criteria serve as source of truth for test generation
- INVEST validation ensures stories are development-ready
- DoR checklist is the final gate before Sprint Planning
- Next step: `/implementation_readiness` for Go/No-Go decision
