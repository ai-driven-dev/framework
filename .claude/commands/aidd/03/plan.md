---
name: 'aidd:03:plan'
description: 'Generate technical implementation plans from requirements'
argument-hint: 'requirements (GitHub issue URL or raw text)'
---

# Goal

Generate technical implementation plans from requirements, save to task file, display for review, and wait for user confirmation before proceeding.

## Rules

- LESS IS MORE, do not over-engineer
- DO NOT CODE ANYTHING
- Create plan from provided requirements
- Save plan to task file before displaying
- Handle vocal dictation inconsistencies
- Configurations (e.g. api keys etc) must be prepared asap in phase 0
- Split phases on responsibilities not convenience

## Context

Use the following requirements as input:

```text
$ARGUMENTS
```

## Resources

### Template

```markdown
@aidd_docs/templates/aidd/plan.md
```

## Steps

### Step 1: Parse Input

1. Detect input type (GitHub URL vs raw text)
2. Extract requirements from input:
   - For GitHub issue: fetch and parse issue content
   - For raw text: clean and structure the requirements
3. Normalize text (handle vocal dictation issues)
4. Print user journey simplified in ASCII diagram for better understanding and validation

### Step 2: Risk/Impact Assessment

Determine: simple plan or master plan?

| Criteria                        | Score |
| ------------------------------- | ----- |
| Breaking changes to public APIs | +3    |
| Database/schema migrations      | +3    |
| 3+ modules affected             | +2    |
| 5+ modules affected             | +3    |
| Major refactoring               | +2    |
| External dependency upgrades    | +2    |

> IMPORTANT: each part of the plan must be doable without the next ones (independent phases for compatibility).

**Decision**:

- Score < 3 → **simple plan** (`plan.md` template)
- Score >= 3 → **master plan** (`master_plan.md` + child plans)

### Step 3: Validate Technical Assumptions

You will try to fine "what could go wrong?" and anticipate as early as possible any potential issue, risk, or blocker that could arise during the implementation of the plan.

Spawn a new sub-agent task to:

5. **Explore the codebase** to inform plan generation
6. **List implicit assumptions** about the user's infrastructure
7. **Verify API feasibility** before committing to an approach
8. **Find flag blockers early** identify issues and risks that will certainly occur during implementation if not addressed in the plan.
9. **Check against official documentation** to validate assumptions and identify potential issues

### Step 4: Task Planning

> Define main phases, do not mention specific files, have macro-level vision.

10. **Wait for user validation** regarding main phases, YOU MUST BOTH AGREED BEFORE PROCEEDING NEXT.
11. Analyze requirements to identify main implementation phases
12. For each phase, create minimal, specific, actionable tasks
13. Ensure comprehensive coverage of all requirements

### Step 4: Generate and Save Implementation Plan

14. Use current !`date`
15. Determine feature name from requirements
16. Insert user journey in mermaid syntax in plan for better visualization and validation
17. Fill the appropriate template based on decisions
18. **Save to file**:
   - Simple plan: `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>-<feature_name>.md`
   - Master plan: `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>-<feature_name>-master.md`
   - Child plans: `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>-<feature_name>-part-N.md`
19. Display saved file path to user

### Step 5: Quality Assurance

20. Verify plan addresses all requirements
21. Check for potential challenges and obstacles
22. Evaluate confidence (0-10 scale):
   - ✅ Reasons for high confidence
   - ❌ Reasons for low confidence / risks
23. Ensure minimum confidence score of 9/10
24. Add confidence assessment to plan

### Step 6: Display and Confirm

25. Display the complete generated plan to user
26. Show confidence assessment
27. Highlight any risks or concerns
28. Plan is now ready for implementation, challenge it with User
29. **WAIT FOR USER APPROVAL** before implementation
