---
name: market_research
description: Structure raw market research into validated RESEARCH_REPORT.md with triangulation
argument-hint: pasted research report OR file path to research
model: sonnet
---

# Market Research

## Goal

Transform raw market research (from Deep Research/Perplexity) into structured RESEARCH_REPORT.md with:
- Triangulation validation (✅/🟡/❌)
- Competitive comparison tables
- Table stakes identification
- Confidence metrics

## Rules

- Apply triangulation rule: 2+ sources = ✅ Verified / 1 source = 🟡 Probable / 0 sources = ❌ Uncertain
- Extract source URLs for all claims
- Structure competitive data as tables (not prose)
- Flag contradictory evidence explicitly
- Output must follow research_report.md template

## Context

```text
$ARGUMENTS
```

## Steps

### Step 1: Load Context & Research

1. Load `{{DOCS}}/internal/product/BRIEF.md` (if exists):
   - Extract problem statement
   - Extract personas (target users)
   - Extract value proposition
2. Parse `$ARGUMENTS`:
   - If file path → load research report file
   - If pasted content → treat as raw research
3. Display what was loaded:
   ```
   📄 Loaded BRIEF.md (Problem: [x], Personas: [y])
   📊 Research input: [X] characters, [Y] source URLs detected
   ```
4. **WAIT FOR CONFIRMATION**

### Step 2: Parse & Validate Research

1. **Extract findings** with source attribution:
   - Market sizing (TAM/SAM/SOM)
   - Market trends (2025-2026)
   - Competitor list (names, pricing, features)
   - Table stakes features
   - Differentiation gaps
2. **Apply triangulation rule** for each finding:
   - Count sources supporting claim
   - Classify: ✅ Verified (2+ sources) / 🟡 Probable (1 source) / ❌ Uncertain (no sources)
   - Extract source URLs
3. **Flag contradictory evidence**:
   - Identify claims with conflicting sources
   - Document both sides with citations
4. **Display validation summary**:
   ```
   Triangulation Results:
   - ✅ Verified: [X] findings (2+ sources)
   - 🟡 Probable: [Y] findings (1 source)
   - ❌ Uncertain: [Z] findings (needs validation)

   ⚠️ Warning: [Z] findings have low confidence. Manual verification recommended.
   ```
5. **WAIT FOR USER APPROVAL**

### Step 3: Structure Competitive Analysis

1. **Generate Value Map table**:
   ```markdown
   | Competitor | Pricing (5-20p team) | Key Strengths | Key Weaknesses | Missing Features (our opportunity) | Sources |
   |------------|---------------------|---------------|----------------|-----------------------------------|---------|
   | [name] | [price] | [strengths] | [weaknesses] | [gaps] | [URLs] |
   ```
2. **Identify table stakes**:
   - Features present in 3+ competitors = table stakes
   - List with frequencies
3. **Identify positioning opportunity**:
   - Weaknesses recurring in 2+ competitors
   - Unmet needs from BRIEF.md personas validation
4. **Display competitive summary**:
   ```
   Competitive Landscape:
   - [X] competitors analyzed
   - [Y] table stakes features identified
   - [Z] differentiation opportunities found
   ```

### Step 4: Generate Research Report

1. **Populate template**: @{{DOCS}}/templates/pm/research_report.md
2. **Fill sections**:
   - Summary table (date, type: market, conducted by, key question from BRIEF)
   - Key Findings table (finding, confidence, evidence type, source, implication)
   - Market Research section (market sizing table, trends with sources)
   - Competitive Research section (competitor benchmark, differentiation gaps, moat analysis)
   - Table Stakes Features section (new)
   - Contradictory Evidence (if any)
   - Research Limitations (what couldn't be researched)
   - Remaining Unknowns (questions needing validation)
   - Decisions Informed (what this research enables)
   - Validation & Confidence section (new)
3. **Add validation checklist**:
   ```markdown
   ## Validation & Confidence

   | Section | Triangulation Status | Confidence | Notes |
   |---------|---------------------|------------|-------|
   | Market Sizing | ✅ [X/Y verified] | High/Medium/Low | [notes] |
   | Competitor Pricing | 🟡 [verify manually] | Medium | Prices should be verified on official sites |
   | Table Stakes | ✅ [validated] | High | Consistent across 3+ competitors |
   | Trends | ✅ [X/Y verified] | High/Medium/Low | [notes] |

   ### Readiness Checklist
   - [ ] All TAM/SAM/SOM claims have 2+ sources
   - [ ] Competitor prices verified on official websites (manual step)
   - [ ] Table stakes validated against 3+ competitors
   - [ ] Contradictory evidence explicitly documented
   - [ ] Remaining unknowns listed with validation methods
   ```
4. Save to `{{DOCS}}/internal/product/RESEARCH_REPORT.md`
5. **Display completion summary**:
   ```
   ✅ Market Research Report complete!

   📄 RESEARCH_REPORT.md includes:
   - [X] findings (✅ [Y] verified, 🟡 [Z] probable)
   - [A] competitors analyzed
   - [B] table stakes identified
   - [C] differentiation opportunities

   ⚠️ Next steps:
   1. Manually verify competitor pricing on official sites
   2. Validate [Z] probable findings with additional sources
   3. Ready for course 0510 (Prototypage) - use table stakes for MVP scope

   📂 Location: {{DOCS}}/internal/product/RESEARCH_REPORT.md
   ```

## Output

- `{{DOCS}}/internal/product/RESEARCH_REPORT.md` - Structured market research report
