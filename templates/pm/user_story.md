---
name: user-story
description: Template for defining user stories with estimation and acceptance criteria
argument-hint: N/A
---

# [Epic Name]

## US-[ID]: "[User Story Title]"

| Field | Value |
| ----- | ----- |
| **Epic** | [Epic name] |
| **Priority** | Must / Should / Could / Won't |
| **Story Points** | [1 / 2 / 3 / 5 / 8 / 13] |
| **Status** | Draft / Ready / In Progress / Done |

**As a** [role]
**I want** [action]
**So that** [outcome]

### Dependencies & Constraints

| Type | Item | Status | Risk |
|------|------|--------|------|
| Blocks | [Story ID or component] | blocked / unblocked | high / medium / low |
| Blocked by | [Story ID or component] | blocking / resolved | high / medium / low |
| Technical | [API / service / system] | available / pending | high / medium / low |
| Data | [data source] | ready / pending | high / medium / low |

### Acceptance Criteria

#### Happy Path

```gherkin
Scenario: [User successfully completes action]
  Given [initial context]
  When [action performed]
  Then [expected result]
  And [additional verification]
```

#### Error Scenarios

```gherkin
Scenario: [Error condition]
  Given [error context]
  When [error trigger]
  Then [graceful error handling]

Scenario: [Boundary condition]
  Given [edge case context]
  When [edge action]
  Then [expected behavior]
```

### Non-Functional Requirements

| Category | Requirement | Success Criterion |
|----------|-------------|-------------------|
| Performance | [requirement] | [measurable target] |
| Security | [requirement] | [measurable target] |
| Accessibility | [requirement] | [measurable target] |

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

### Estimation Basis

| Assumption | Confidence | Impact if wrong |
|-----------|------------|-----------------|
| [technical or scope assumption] | High / Medium / Low | [+X points or rework risk] |

### Known Unknowns

- [ ] [Unknown] — clarify with [stakeholder]
- [ ] [Technical spike needed] for [component]

---

...
