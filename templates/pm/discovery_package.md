# Discovery Package - [Project Name]

**Date**: !`date +%Y-%m-%d`
**Sources**: [List of interview transcripts and user data analyzed]
**Analyst**: [Name] + AI
**Brief**: [Link to BRIEF.md]

> **Purpose**: User research document containing insights extracted from interview data.
> **Optional**: Use this when you have real user interviews to analyze. Key insights should be integrated into the Brief.
> For market research and personas from secondary data, use RESEARCH_REPORT.md (course 0502).

> **Templates used**:
>
> - [brief.md](./brief.md) — Strategic intent (integrate key insights here)
> - [interview_transcript.md](./interview_transcript.md) — Primary sources (Appendix)
> - [persona.md](./persona.md) — User personas (Section 2)
> - [jtbd.md](./jtbd.md) — Jobs To Be Done (Section 3)

---

## Summary

| Field | Value |
|-------|-------|
| Brief | [BRIEF.md link] |
| Interviews analyzed | [number] |
| User profiles identified | [number] |
| Personas created | [number] |
| JTBD formulated | [number] |
| Pain points validated | [number] |
| Overall confidence | High / Medium / Low |

---

## 1. Insights Report

### 1.1 Recurring Themes

| Theme | Frequency | Sources | Representative Quote |
|-------|-----------|---------|---------------------|
| [theme] | [X/Y interviews] | [sources] | "[verbatim]" |

### 1.2 Pain Points (Validated)

| # | Pain Point | Severity | Frequency | Evidence | User Profile | Triangulation |
|---|------------|----------|-----------|----------|--------------|---------------|
| 1 | [pain point] | critical/high/medium/low | [X/Y] | [verbatim citations] | [profile] | ✅ Verified |

### 1.3 Behavioral Patterns

| Pattern | Description | Observed In | Implication |
|---------|-------------|-------------|-------------|
| [pattern] | [description] | [sources] | [product implication] |

### 1.4 Emotional Triggers

| Trigger | Emotion | Context | Quote |
|---------|---------|---------|-------|
| [trigger] | frustration/joy/anxiety/relief | [situation] | "[verbatim]" |

### 1.5 Hypotheses Emerging

| # | Hypothesis | Confidence | Evidence | Validation Method |
|---|------------|------------|----------|------------------|
| 1 | [hypothesis] | high/medium/low | [sources] | [how to test] |

### 1.6 Verbatims Library

**[Theme 1]**

> "[verbatim 1]"
> — [Name], [Role], [Interview Date]

---

## 2. User Profiles & Empathy Maps

> **Note**: Quick synthesis to capture emotional and behavioral context.
> For detailed personas with economic and technical profiles, see **Section 3 Personas**.

### Profile 1: [Name/Role]

**Context**: [daily situation]

#### 💭 Thinks

**Internal concerns**:
- [concern 1]
- [concern 2]

**Sources**: [interview citations]

#### ❤️ Feels

**Expressed emotions**:
- [emotion 1: frustration] → "[verbatim]"
- [emotion 2]

**Emotional triggers**: [triggers]

#### 💬 Says

> "[verbatim 1]"
> — [Interview source]

> "[verbatim 2]"

**Recurring phrases**: [patterns]

#### 🏃 Does

**Observed behaviors**:
- [action 1]
- [action 2]

**Current workarounds**: [workarounds]

**Tools used**: [tools, frequency]

#### Pains & Gains

**Pains**:
- [pain 1] → blocks [goal]

**Desired gains**:
- [gain 1]

**Validation**: [X sources, ✅ Triangulated]

---

## 3. Personas

> **Template**: Use [persona.md](./persona.md) for each identified persona.
> Each persona must be validated by **2-3+ sources** minimum (triangulation).

### Persona 1: [Name], [short role]

**Role**: [description]
**Context**: [daily situation]

#### Goals

- [goal 1]
- [goal 2]

#### Motivations

- [motivation 1 — psychological driver: efficiency, recognition, autonomy]
- [motivation 2]

#### Frustrations

- [frustration 1 — quote if available]
- [frustration 2]

#### Observed behaviors

- [behavior 1]
- [behavior 2]

#### Economic profile

| Data | Value |
|------|-------|
| Income / Budget | [level or range] |
| Category spending | [typical monthly amount] |
| Price sensitivity | low / medium / high |
| Purchase frequency | [frequency] |

#### Technical environment

| Data | Value |
|------|-------|
| Primary device | [device + version] |
| OS | [iOS / Android / Web / Desktop] |
| Technical proficiency | novice / intermediate / advanced |
| Favorite apps | [list with usage context] |

#### Tools and digital habits

- [tool 1 — usage frequency]
- [tool 2]
- [observed digital habit]

#### Industry expectations

- [market expectation 1 — source if available]
- [market expectation 2]

#### Key quote

> "[representative verbatim]"

#### Sources

| Donnée    | Source                                  | Type              |
|-----------|-----------------------------------------|-------------------|
| [insight] | [interview / analytics / observation]   | internal / external |

**Validation**: ✅ Triangulated (2/3+ sources)

---

## 4. Jobs To Be Done (JTBD)

> **Template**: Use [jtbd.md](./jtbd.md) for each identified JTBD.
> Each JTBD must include evidence and be associated with a persona.

### JTBD-01: [Need name]

**When** [observable situation/context]
**I want** [action/capability]
**So that** [benefit/outcome]

**Associated persona**: [Persona X]

#### Evidence

- Interview: "[quote]" — [source]
- Data: [measured metric]
- Observation: [observed behavior]

**Triangulation**: ✅ Verified (3 sources)

#### Formulation rules

- The "When" must be a real, observable situation.
- The "I want" expresses a capability, not a technical solution.
- The "So that" is the user's true goal.

---

## 5. Prototype Feedback (si prototype validé)

> Section filled after prototyping (lesson 0510). Captures user feedback on the prototype to feed the PRD.

### Prototype Info

| Field | Value |
|-------|-------|
| Tool | [Lovable / Bolt / v0.dev / Claude Artifacts] |
| Test date | [date] |
| Testers | [number and profiles] |

### User feedback

| # | Feedback | Type | Persona | Impact | Action |
|---|----------|------|---------|--------|--------|
| 1 | [verbatim feedback] | positive / negative / suggestion | [Persona X] | critical / important / minor | [Integrate PRD / Ignore / Backlog] |

### Validated / invalidated hypotheses

| Hypothesis (Section 1.5) | Proto result | Evidence | Decision |
|--------------------------|--------------|----------|----------|
| [H1] | ✅ Validated / ❌ Invalidated | [observation / quote] | [Pivot / Confirm / Investigate] |

### Validated flows

- [ ] [Flow 1: description] → ✅ Validated by [X] testers
- [ ] [Flow 2: description] → ⚠️ Frictions detected: [detail]
- [ ] [Flow 3: description] → ❌ Failed: [reason]

---

## 6. Next Steps

### Integrate into Brief

- [ ] Add key verbatims to BRIEF.md "Target User" section
- [ ] Include validated pain points
- [ ] Document sources

### For Market Research (lesson 0502)

- [ ] Run Deep Research to validate market
- [ ] Generate RESEARCH_REPORT.md with competitors and Table Stakes
- [ ] Enrich personas with market data

### Compile Prompt Package

- [ ] Combine Brief + Research Report + Personas
- [ ] Ready for injection into AI builder

### For Prototyping (lesson 0510)

- [ ] Inject Prompt Package into AI builder (V0, Lovable, Bolt)
- [ ] Test hypotheses from Brief
- [ ] Validate with real users
- [ ] After testing → Fill Section 5 "Prototype Feedback" above

---

## 7. Validation & Confidence

| Section | Triangulation Status | Confidence | Notes |
|---------|---------------------|------------|-------|
| Insights | ✅ [X/Y verified] | High/Medium/Low | [notes] |
| Empathy Maps | ✅ [sources count] | High/Medium/Low | [notes] |
| Personas | ✅ [2/3+ sources] | High/Medium/Low | [notes] |
| JTBD | ✅ [evidence attached] | High/Medium/Low | [notes] |

---

## Appendix: Interview Sources

> **Template**: Each interview source should use [interview_transcript.md](./interview_transcript.md)

- `interview_2024_01_15-Marie-Designer.md`
- `interview_2024_01_18-Paul-Developer.md`
- `interview_2024_01_20-Alex-PM.md`
