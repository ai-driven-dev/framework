---
name: extract_brief
description: Extract light Brief from brain dump - strategic intent for prototyping (Reverse Flip)
argument-hint: brain_dump.md
model: sonnet
---

# Extract Brief

## Goal

Generate **BRIEF.md** — a light strategic document (1-2 pages) that serves as input for:

- **Deep Research**: Market validation and persona generation
- **Prompt Package**: Combined with Research Report for AI prototyping

## Rules

- XYZ format: "We build **X** for **Y** to achieve **Z**"
- Keep document light (1-2 pages maximum)
- Focus on strategic intent, not detailed features
- Include user insights if available (interviews, feedback)
- No scope details, no features, no metrics (comes AFTER prototype)

## Context

```text
$ARGUMENTS
```

## Steps

### Step 1: Read Brain Dump

Load brain dump from `$ARGUMENTS` and identify:

- Product/project idea
- Target users mentioned
- Problems to solve
- Any existing user data (interviews, feedback)

### Step 2: Extract Vision & Strategy

Structure the following elements:

| Element | Question to Answer |
|---------|-------------------|
| **XYZ Formula** | "We build X for Y to achieve Z" |
| **Context** | What exists today and why it's painful? |
| **Target User** | Who suffers most? Include verbatims if available |
| **Solution** | Value proposition in 2-3 sentences |
| **Differentiation** | Why us vs existing alternatives? |

### Step 3: Integrate User Insights (if available)

If user data exists (interviews, feedback):

- Include key verbatims in Target User section
- Add observed pain points
- Document sources

> 1 real interview is worth 10 AI simulations.

### Step 4: Identify Hypotheses

List what needs to be validated with the prototype:

| #  | Hypothesis                               | Validation Method              |
|----|------------------------------------------|--------------------------------|
| H1 | [hypothesis about user/market/solution]  | [prototype / interview / data] |
| H2 | [hypothesis]                             | [validation method]            |

### Step 5: Document Sources

Track all evidence:

| Element   | Source                           | Type         |
|-----------|----------------------------------|--------------|
| [insight] | [interview / data / observation] | qual / quant |

### Step 6: Generate Brief

1. Use template: `@{{FRAMEWORK}}/templates/pm/brief.md`
2. Populate all sections
3. Save to `{{DOCS}}/internal/product/BRIEF.md`

### Step 7: Display Summary

```text
✅ Brief generated!

📄 BRIEF.md includes:
- XYZ Formula defined
- Target user identified
- [X] hypotheses to validate
- [X] sources documented

Next steps:
1. Run Deep Research (course 0502) → RESEARCH_REPORT.md with Personas
2. Compile Prompt Package (Brief + Research + Personas)
3. Inject into AI builder for prototyping
```
