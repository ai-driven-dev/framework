---
name: 'aidd:02:create_user_stories'
description: 'Create user stories through iterative questioning'
argument-hint: [Feature description or requirements for user story generation]
---

# Create perfect User Stories for a developer

## Goal

Generate well-structured user stories from feature requirements through systematic Product Owner questioning.

## Rules

- No technical aspect, focus on user needs
- Requirements started from $ARGUMENTS
- Lean, concise approach
- 3 max questions per iteration
- Sort by implementation priority
- All checklists must be satisfied

### INVEST Checklist

- [ ] **I**ndependent — can be developed without other stories
- [ ] **N**egotiable — details can be discussed
- [ ] **V**aluable — delivers value to the user
- [ ] **E**stimable — team can estimate the effort
- [ ] **S**mall — fits in a single sprint
- [ ] **T**estable — acceptance criteria are verifiable

### Definition of Ready

- [ ] Acceptance criteria defined
- [ ] Dependencies identified
- [ ] Story points estimated
- [ ] No blocking questions

## Context

### User Story Template

```markdown
@aidd_docs/templates/pm/user_story.md
```

## Steps

1. Ask clarifying questions to understand completeness (problem, features, criteria, scope, constraints)
2. Refine story understanding to user
3. Iterate until you are both satisfied
4. Format stories using user story template
5. **Wait for user validation**
6. Save it to the ticketing system
