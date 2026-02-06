---
name: generate_backlog_initial
description: Generate initial product backlog (Epics + User Stories) from validated PRD
argument-hint: PRD file path or use default {{DOCS}}/internal/product/PRD.md
---

# Generate Initial Product Backlog

## Goal

Transform a validated PRD into an initial structured backlog with Epics and User Stories, using the COSTAR framework for systematic decomposition.

## Context

You are a Product Owner Agile expert specialized in backlog generation. You transform product requirements into actionable user stories that development teams can estimate and implement.

## Rules

- **PRD-first**: Always start from a validated PRD
- **COSTAR framework**: Use structured prompting for consistency
- **Traceability**: Every story must trace back to a PRD feature
- **User-centric**: Stories follow "As a [persona], I want [action], so that [benefit]" format
- **High-level**: Generate Epics and high-level stories (detailed refinement comes later)
- **MoSCoW preview**: Assign initial priority classification

## Input

```text
$ARGUMENTS
```

## Steps

### Step 1: Load Required Documents

1. Read the following files:
   - **PRD**: `{{DOCS}}/internal/product/PRD.md` (or path from $ARGUMENTS)
   - **Discovery Package**: `{{DOCS}}/internal/product/DISCOVERY_PACKAGE.md` (Personas + JTBD)
   - **Research Report**: `{{DOCS}}/internal/product/RESEARCH_REPORT.md` (if exists)

2. Verify all files exist and contain the required sections:
   - PRD must have: Core Features, Target Users, Goals & Objectives
   - Discovery Package must have: Personas, JTBD

3. If any required file is missing, inform the user and provide guidance on how to generate them.

### Step 2: Generate Backlog Using COSTAR Prompt

Use the following structured prompt with the AI:

```markdown
**CONTEXT**
Tu es un Product Owner Agile expert spécialisé dans la génération de backlogs produit. Tu travailles avec une équipe Scrum et tu dois décomposer un PRD validé en Epics et User Stories actionnables.

**OBJECTIVE**
Génère un backlog produit initial complet à partir du PRD ci-joint. Décompose-le en Epics (grandes fonctionnalités) et User Stories (tâches utilisateur de haut niveau). Assure une traçabilité complète entre chaque story et les features du PRD.

**STYLE**
Tableau Markdown structuré avec colonnes claires. Format standard pour les User Stories : "En tant que [persona], je veux [action] afin de [bénéfice]".

**TONE**
Pratique, concis et centré utilisateur. Évite le jargon technique inutile. Chaque story doit clairement exprimer la valeur pour l'utilisateur final.

**AUDIENCE**
L'équipe Scrum (développeurs, designers, QA) qui va estimer et implémenter ces stories lors du Sprint Planning.

**RESPONSE FORMAT**
Génère un tableau Markdown avec les colonnes suivantes :
- **Epic** : Nom de l'Epic (grande fonctionnalité regroupant plusieurs stories)
- **User Story** : Format "En tant que [persona], je veux [action] afin de [bénéfice]"
- **Persona Associé** : Persona principal concerné (référence au Discovery Package)
- **Priorité MoSCoW** : Must Have / Should Have / Could Have / Won't Have
- **Feature PRD** : Référence à la section/feature du PRD (traçabilité)

**INPUT DOCUMENTS**
[Insert PRD content here]
[Insert Personas from Discovery Package here]
[Insert JTBD from Discovery Package here]

**CONSTRAINTS**
- Chaque User Story doit tracer vers une feature du PRD
- Chaque User Story doit être associée à un persona identifié
- Éviter les détails techniques d'implémentation (focus sur le QUOI et POURQUOI, pas le COMMENT)
- Prioriser en MoSCoW selon la criticité MVP (Must Have = indispensable pour l'MVP)
- Grouper les stories logiquement en Epics (3-8 stories par Epic idéalement)
```

### Step 3: Validate Backlog Quality

For each generated story, verify:

1. **Format Compliance**: Story follows "En tant que... je veux... afin de..." format
2. **Persona Assignment**: Each story is assigned to a specific persona
3. **PRD Traceability**: Each story references a PRD section/feature
4. **MoSCoW Classification**: Each story has a priority (Must/Should/Could/Won't)
5. **Epic Grouping**: Stories are logically grouped into Epics (3-8 stories per Epic)

### Step 4: Generate Output Document

Create the initial backlog document in Markdown format:

```markdown
# Product Backlog Initial

> Generated from PRD version X.X on [date]

## Backlog Overview

| Epic | User Story | Persona | Priority | Feature PRD |
|------|------------|---------|----------|-------------|
| [Epic Name] | [Story] | [Persona] | [MoSCoW] | [PRD Section] |
| ... | ... | ... | ... | ... |

## Epic Breakdown

### Epic 1: [Epic Name]

**Objective**: [What this Epic delivers to users]

**Stories**:

#### US-001: [Story Title]
- **As a** [persona]
- **I want** [action]
- **So that** [benefit]
- **Priority**: Must Have
- **PRD Reference**: Section X.X - [Feature Name]

[Repeat for each story in this Epic]

---

[Repeat for each Epic]
```

### Step 5: Save and Notify

1. Save the backlog to: `{{DOCS}}/internal/product/USER_STORIES_INITIAL.md`
2. Display summary statistics:
   - Total Epics: X
   - Total Stories: X
   - Must Have: X stories
   - Should Have: X stories
   - Could Have: X stories
   - Won't Have: X stories

- **WAIT FOR USER VALIDATION** before proceeding

## Output

- **File Created**: `{{DOCS}}/internal/product/USER_STORIES_INITIAL.md`
- **Format**: Markdown table + Epic breakdown with story details
- **Next Step**: Use `/extract_milestones` to organize stories into deliverable milestones

## Quality Checklist

- [ ] All stories follow "En tant que... je veux... afin de..." format
- [ ] Every story is assigned to a persona
- [ ] Every story traces to a PRD feature
- [ ] Every story has MoSCoW priority
- [ ] Stories are grouped into logical Epics (3-8 stories per Epic)
- [ ] No technical implementation details in stories (focus on user value)
- [ ] Must Have stories represent minimum viable product
- [ ] Won't Have items are explicitly documented (scope boundaries)

## Notes

- This generates the **initial high-level backlog**
- Detailed refinement (Gherkin criteria, estimation, dependencies) happens in `/refine_user_stories`
- Prioritization and estimation happens in `/prioritize_backlog`
- Milestone extraction happens in `/extract_milestones`
