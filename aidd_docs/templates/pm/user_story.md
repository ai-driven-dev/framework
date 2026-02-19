---
name: user-story
description: Template for defining user stories with estimation and acceptance criteria
argument-hint: N/A
---

# [Epic Name]

## US-[ID]: "[User Story Title]"

**As a** [role]
**I want** [action]
**So that** [outcome]

| Estimation | Priorité | Epic |
|---|---|---|
| [1/2/3/5/8] pts | Must / Should / Could | [Epic Name] |

### Acceptance Criteria

```gherkin
Scenario: [Happy path]
  Given [nominal context]
  When [action]
  Then [expected result]

Scenario: [Error condition]
  Given [error context]
  When [error trigger]
  Then [graceful error handling]

Scenario: [Boundary condition]
  Given [edge case context]
  When [edge action]
  Then [expected behavior]
```

### Dependencies

- [Other stories, APIs, or services this story depends on]
