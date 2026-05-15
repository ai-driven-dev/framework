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

### Acceptance Criteria

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
