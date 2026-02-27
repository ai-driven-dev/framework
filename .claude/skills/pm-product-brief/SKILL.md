---
name: 'pm-product-brief'
description: 'Validates problem, personas, and market then generates a product brief. Use when you need to validate assumptions and create a structured product brief from a constitution.'
---

# Create Product Brief

## Goal

Validate that the right problem is being solved for the right people, then synthesize findings into a structured product brief.

## Rules

- Never skip validation — assumptions must be challenged with data
- Hypotheses must be testable and falsifiable
- Competitive analysis must identify table stakes AND differentiators
- The product brief is generated ONLY after challenge gate passes
- Requirements started from $ARGUMENTS
- When $ARGUMENTS references a detailed existing specification, treat it as validation data. Extract hypotheses from it and mark them as pre-validated. Competitive analysis and persona definition still apply — use the specification as the primary source.
- **Standalone usage** — when invoked directly (not through an agent), present the deliverable and ask for user approval

## Quick Start

```text
Create a product brief based on our constitution
```

## Workflow

```mermaid
flowchart LR
    A[Read constitution] --> B[Extract hypotheses] --> C[Online research] --> D[Interview guide] --> E[Synthesize field data] --> F[Competitive analysis] --> G[Challenge gate] --> H[Save product_brief.md]
```

### Step 1: Extract Hypotheses

**Do:**

1. Read the constitution or idea from $ARGUMENTS
2. Extract key hypotheses to validate (problem, persona, market)
3. For each hypothesis, propose a validation method and risk if false

**Success criteria:** All key hypotheses identified with validation methods

### Step 2: Online Research & Interview Preparation

**Do:**

4. Conduct online research on public sources relevant to the hypotheses:
   - User reviews and ratings on existing solutions (stores, evaluation platforms)
   - Forum discussions, community Q&A, social media mentions
   - Industry reports, market data, job postings (signals on market evolution)
   - Competitor documentation, pricing, positioning, public changelogs
5. Synthesize online findings: recurring frustrations, unmet needs, market signals
6. Generate an interview guide using the Jobs-To-Be-Done framework:
   - 8-12 open-ended questions structured from general to specific
   - For each key hypothesis, at least one question that can validate or invalidate it
   - JTBD format for core questions: "When [situation], what do you want to achieve, and what happens instead?"
   - No leading questions ("Would you like...?" → "How do you handle...?")
7. Suggest survey questions for quantitative validation (if applicable)
8. **WAIT FOR USER RESPONSE** — user conducts field research (interviews, surveys, observations) and provides the data

**Success criteria:** Online research synthesized, interview guide delivered to user, field data received

### Step 3: Synthesize & Competitive Analysis

**Do:**

9. Analyze field data using structured synthesis:
   - **Cluster** verbatims and feedback by theme (group recurring topics)
   - **Detect patterns**: correlations between user segments and pain points
   - **Cross-reference** online and field data: distinguish systemic problems from local ones
10. Produce 4 types of insights:
   - **Recurring frustrations**: problems mentioned by 3+ sources
   - **Behavioral patterns**: how users actually do things (vs what they say)
   - **Current workarounds**: solutions users have built themselves
   - **Implicit needs**: what users ask for without saying it explicitly
11. Build competitive value map:
   - **Table stakes**: what every competitor does (minimum expected)
   - **Differentiators**: what distinguishes each competitor
   - **Unserved needs**: validated needs that no competitor covers
12. Define primary persona backed by research data (using persona template)

**Success criteria:** Insights synthesized in 4 categories, value map complete, primary persona defined

### Step 4: Challenge Gate

**Do:**

13. Read the template from Resources
14. Verify every template section exists in the output with the exact same heading name and no section was added beyond what the template defines
15. Verify format requirements: (none — structure only for this skill)

**Success criteria:** All template sections present and format requirements met. If any section is missing or any format is wrong, STOP — fix it. Do NOT proceed until structurally complete.

### Step 5: Save

**Do:**

16. Read the template from Resources. Follow its exact structure — same headings, same table columns, same formats. Do not add, remove, or rename sections.
17. Save as `aidd_docs/memory/internal/product_brief.md`

**Success criteria:** File saved and accessible

## Resources

| Type     | Path                                          | Description              |
| -------- | --------------------------------------------- | ------------------------ |
| Input    | `aidd_docs/memory/internal/constitution.md`            | Project constitution     |
| Template | `aidd_docs/templates/pm/brief.md`             | Brief template           |
| Template | `aidd_docs/templates/pm/discovery_package.md` | Discovery package        |
| Template | `aidd_docs/templates/pm/persona.md`           | Persona template         |
