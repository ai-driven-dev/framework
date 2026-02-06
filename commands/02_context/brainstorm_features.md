---
name: brainstorm_features
description: Generate 5-7 feature ideas from Brief + Research for prototyping
argument-hint: BRIEF.md + RESEARCH_REPORT.md
model: opus
---

# Brainstorm Features

## Goal

**Extract and synthesize 5-7 features** from Brief + Research Report for the Prompt Package. Features are discovered, not invented.

> **Reverse Flip** : On ne devine pas les features. On les extrait des données existantes (Brief, Research, Pain Points).

## Rules

- Never invent features from scratch
- Base all features on documented evidence (Brief, Research Report)
- Include Table Stakes (mandatory market features) AND differentiation
- Output User Story format, not just feature names
- Maximum 7 features for prototype V0
- Must include the "Killer Feature" (unique value proposition)

## Context

```text
$ARGUMENTS
```

## Steps

### Step 1: Load Documents

Load and analyze:

1. `BRIEF.md` — Vision, Target User, Hypotheses
2. `RESEARCH_REPORT.md` — Competitors, Table Stakes, Gaps

If documents not provided, ask user for paths.

### Step 2: Extract Table Stakes

From Research Report, identify mandatory features that ALL competitors have:

| # | Table Stake | Evidence | Priority |
|---|-------------|----------|----------|
| 1 | [feature] | [competitor examples] | Must Have |

> Table Stakes = minimum credibility. You can't skip these.

### Step 3: Identify Differentiation Gaps

From Research Report, find what competitors are MISSING:

| # | Gap | Opportunity | Our Angle |
|---|-----|-------------|-----------|
| 1 | [competitor weakness] | [user need unmet] | [our solution] |

> Gaps = where we can differentiate.

### Step 4: Extract Pain Point Features

From Brief (Target User section) and Research (Personas), extract features that solve documented pain points:

| Pain Point | Source | Feature Idea |
|------------|--------|--------------|
| [verbatim or observation] | [Brief/Research/Interview] | [solution as feature] |

### Step 5: Generate Feature Ideas (AI-Enhanced)

Combine all sources to brainstorm 10-12 potential features:

```text
Based on:
- Table Stakes: [list]
- Differentiation Gaps: [list]
- Pain Points: [list]
- Killer Feature from Brief: [hypothesis to validate]

Generate 10-12 feature ideas as User Stories.
```

### Step 6: Prioritize to 5-7 Features

Use MoSCoW to filter:

| # | Feature (User Story) | Category | Rationale |
|---|----------------------|----------|-----------|
| 1 | [As a..., I want..., so that...] | Must Have | [why essential for V0] |
| 2 | [feature] | Must Have | [rationale] |
| 3 | [feature] | Should Have | [rationale] |

**Keep only Must Have + top Should Have = 5-7 features maximum.**

### Step 7: Identify Killer Feature

From the 5-7 features, mark which one is the **Killer Feature** — the unique value that triggers "I need this now":

```text
⭐ Killer Feature: [feature name]
   Why: [triggers immediate need because...]
   Hypothesis it validates: [H1 from Brief]
```

### Step 8: Format for Prompt Package

Output the final feature list for injection into AI builder:

```markdown
## Core Features for Prototype V0

### Must Have (Table Stakes)
1. **[Feature Name]**: As a [user], I want [action] so that [benefit]
2. ...

### Differentiation
3. **[Feature Name]**: As a [user], I want [action] so that [benefit]
4. ...

### ⭐ Killer Feature
5. **[Feature Name]**: As a [user], I want [action] so that [benefit]
   - Validates: [Hypothesis from Brief]
   - Differentiator: [Why unique]

---

**Total: [X] features for V0 prototype**
```

### Step 9: Display Summary

```text
✅ Features extracted!

📋 [X] features identified:
- [X] Table Stakes (Must Have)
- [X] Differentiation features
- 1 Killer Feature: [name]

📄 Ready for Prompt Package injection

Next steps:
1. Compile Prompt Package (Brief + Research + Features)
2. Inject into AI builder (Lovable, v0.dev, Claude)
3. Generate prototype V0
```

---

## Example Prompt

```text
/brainstorm_features

aidd_docs/internal/product/BRIEF.md
aidd_docs/internal/product/RESEARCH_REPORT.md
```

---

## Anti-patterns

| ❌ Don't | ✅ Do instead | Why |
|----------|---------------|-----|
| Invent features from imagination | Extract from Brief + Research | Features must be evidence-based |
| List 20+ features | Limit to 5-7 for V0 | Prototype tests hypotheses, not builds product |
| Use vague names ("Dashboard") | Write as User Story | AI builder needs context |
| Skip Table Stakes | Always include them | Credibility baseline |
| Forget Killer Feature | Always highlight it | Core value proposition |
