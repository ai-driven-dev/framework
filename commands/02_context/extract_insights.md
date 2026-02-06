---
name: extract_insights
description: Extract user insights, personas, and JTBD from raw data sources
argument-hint: sources/ folder OR specific files (interviews, feedback, notes)
model: opus
---

# Extract Insights

## Goal

Generate **DISCOVERY_PACKAGE.md** — the user research document containing insights, empathy maps, personas, and JTBD.

## Rules

- Requires user data (interviews, feedback, notes, etc.)
- Apply triangulation: 2/3+ sources must converge to validate an insight
- Every persona and JTBD must be traceable to evidence
- Output feeds into `/extract_brief` for an enriched Brief with JTBD + Personas

## Context

```text
$ARGUMENTS
```

## Steps

### Step 1: Load Sources

1. Read all files from `$ARGUMENTS` (folder or specific files)
2. Identify source types:
    - Interview transcripts
    - Meeting notes
    - Customer feedback
    - Support tickets
    - Survey responses
3. If no sources found: **STOP** and ask user to provide data
4. **WAIT FOR CONFIRMATION**

### Step 2: Execute Analysis Sequence

Execute sub-prompts sequentially:

1. `/analyze_raw_data` → Section 1: Insights Report
    - Recurring themes
    - Pain points (validated)
    - Behavioral patterns
    - Emotional triggers
    - Emerging hypotheses

2. `/generate_empathy` → Section 2: User Profiles & Empathy Maps
    - Thinks / Feels / Says / Does
    - Pains & Gains

3. `/generate_personas` → Section 3: Personas
    - 3 variations per user profile
    - Economic profile
    - Technical environment

4. `/generate_jtbd` → Section 4: Jobs To Be Done
    - When / I want / So that
    - Evidence attached

### Step 3: Apply Triangulation

For each insight, persona, and JTBD:

| Classification   | Criteria              | Action                 |
| ---------------- | --------------------- | ---------------------- |
| ✅ **Verified**  | 2+ sources converge   | Include in package     |
| 🟡 **Probable**  | 1 clear source        | Mark as hypothesis     |
| ❌ **Uncertain** | Weak or contradictory | Exclude or investigate |

### Step 4: Compile and Save

1. Generate using template: `@{{DOCS}}/templates/pm/discovery_package.md`
2. Link to `{{DOCS}}/internal/product/VISION_DRAFT.md` if exists
3. Save to `{{DOCS}}/internal/product/DISCOVERY_PACKAGE.md`
4. Display summary:

```text
✅ Discovery Package generated!

📄 DISCOVERY_PACKAGE.md includes:
- X sources analyzed
- Y insights extracted (Z verified)
- N user profiles identified
- P personas created
- Q JTBD formulated
```
