---
name: plan
description: Generate technical implementation plans from requirements
argument-hint: requirements (ticket URL or raw text)
model: opus
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
- `?` is optional, like ticket number (if applicable)
- Architecture projection (modify/create/delete) and applicable rules MUST be user-validated before the plan file is written.

## Context

Use the following requirements as input:

```text
$ARGUMENTS
```

## Resources

### Template

```markdown
@../assets/plan-template.md
```

## Steps

### Step 1: Parse Input

1. Detect input type (ticket URL vs raw text)
2. Extract requirements from input:
   - For ticket URL: fetch and parse ticket content
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

You will try to find "what could go wrong?" and anticipate as early as possible any potential issue, risk, or blocker that could arise during the implementation of the plan.

Spawn a new sub-agent task to:

1. **Explore the codebase** to inform plan generation
2. **List implicit assumptions** about the user's infrastructure
3. **Verify API feasibility** before committing to an approach
4. **Find flag blockers early** identify issues and risks that will certainly occur if not addressed in the plan.
5. **Check against official documentation** to validate assumptions and identify potential issues
6. **Produce the architecture projection** — three lists, each with `path — one-line reason`:
   - files to modify
   - files to create
   - files to delete
7. **Inventory the project rules** — run `node scripts/list-rules.mjs` (from project root). If `aidd_docs/rules/` does not exist, the script returns `[]` — accept silently.

### Step 4: Architecture projection & rules — user validation

> Gate before plan writing. Nothing is written until the human approves.

1. From the rules inventory (Step 3.7), select the rules that apply to the projection:
   - For each rule, decide via its `description` (and `paths` if present) whether it applies to any file in modify/create/delete lists.
   - Justify every selected rule in one line.
   - If the inventory is empty (no `aidd_docs/rules/`), state explicitly: "no rules folder, applicable rules section will be empty".
2. Display to the human:
   - the three M/C/D lists,
   - the table of applicable rules: `name | path | why it applies`.
3. Ask: "Is this projection correct? Anything to add or remove? A missing rule?"
4. **WAIT FOR USER APPROVAL.** Do not proceed to Step 5 until validated.
5. If the human corrects any list, update and re-confirm. Iterate until approved.

### Step 5: Task Planning

> Define main phases, do not mention specific files, have macro-level vision.

1. **Wait for user validation** regarding main phases, YOU MUST BOTH AGREED BEFORE PROCEEDING NEXT.
2. Analyze requirements to identify main implementation phases
3. For each phase, create minimal, specific, actionable tasks
4. Ensure comprehensive coverage of all requirements

### Step 6: Generate and Save Implementation Plan

1. Use current !`date`
2. Determine feature name from requirements
3. Insert user journey in mermaid syntax in plan for better visualization and validation
4. Fill the appropriate template based on decisions, including the validated `Architecture projection` (M/C/D) and `Applicable rules` from Step 4.
5. **Fill execution frontmatter** (required — the plan IS the For Sure tracking file):
   - `objective`: one-sentence statement of what must be true when done
   - `success_condition`: a **runnable command** that proves done (e.g. `npm test exits 0 AND coverage > 80%`). If no obvious command exists, ask the user. Reject vague conditions.
   - `iteration: 0`
   - `created_at`: ISO 8601 timestamp from step 1
6. **Save to file**:
   - Simple plan: `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>-?<#ticket_number>-<feature_name>.md`
   - Master plan: `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>-?<#ticket_number>-<feature_name>-master.md`
   - Child plans: `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>-?<#ticket_number>-<feature_name>-part-N.md`
7. Display saved file path to user

### Step 7: Quality Assurance

1. Verify plan addresses all requirements
2. Check for potential challenges and obstacles
3. Evaluate confidence (0-10 scale):
   - ✅ Reasons for high confidence
   - ❌ Reasons for low confidence / risks
4. Ensure minimum confidence score of 9/10
5. Add confidence assessment to plan

### Step 8: Display and Confirm

1. Display the complete generated plan to user
2. Show confidence assessment
3. Highlight any risks or concerns
4. Challenge the plan with the user
5. **WAIT FOR USER APPROVAL**
