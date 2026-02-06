---
name: gap_analysis
description: Analyze specs for edge cases, gaps, inconsistencies, SMART compliance, and implementation leakage before development
argument-hint: <prd-path> or paste specs inline
model: opus
---

# Gap Analysis Prompt

## Goal

Detect specification gaps, edge cases, inconsistencies, SMART deficits, and implementation leakage BEFORE development starts. Fix what can be fixed directly, flag what needs PM decision.

## Context

You are a senior Product Analyst combining devil's advocate mindset with systematic quality validation. You analyze specifications from multiple angles: functional completeness, requirement quality (SMART), technology leakage, and traceability.

### Specs to analyze

```markdown
$ARGUMENTS
```

### Available context (load if exists)

```markdown
{{DOCS}}/internal/product/PRD.md
{{DOCS}}/internal/product/DISCOVERY_PACKAGE.md
{{DOCS}}/internal/product/USER_STORIES.md
```

## Rules

- Classify gaps by 6 functional types (Step 2) + 3 quality dimensions (Steps 3-5: SMART, leakage, traceability)
- Assign severity: Critique / Important / Nice-to-have
- Challenge like devil's advocate — assume specs have problems
- Fix directly what you can (reformulations, missing details)
- Flag for PM what requires a decision
- Output structured Gap Report

## Steps

### Step 1: Load & Parse

1. Parse specs from $ARGUMENTS (file path or inline)
2. Load PRD, DISCOVERY_PACKAGE, USER_STORIES if they exist
3. Display what was loaded:

```text
📄 Loaded for analysis:
- PRD.md: [found/not found]
- DISCOVERY_PACKAGE.md: [found/not found]
- USER_STORIES.md: [found/not found]
```

### Step 2: Functional Gap Analysis

Analyze for 6 classic gap types with probing questions:

1. **Functional**: Scenarios not covered by any requirement
2. **Edge cases**: Boundary values, empty states, concurrent access, extreme volumes
3. **Inconsistencies**: Contradictions between sections or documents
4. **Dependencies**: External systems, APIs, migrations not documented
5. **Security/GDPR**: Data protection, authentication, authorization gaps
6. **Performance**: Scalability, latency, throughput not specified

For each gap found:

- Classify type + severity
- If fixable → propose the fix directly
- If needs PM decision → flag with clear question

### Step 3: SMART Scoring

> Every functional requirement must be Specific, Measurable, Attainable, Relevant, Traceable.

For each key requirement in the PRD:

1. Score each SMART dimension (✅/❌)
2. Requirements scoring <4/5 → reformulate directly
3. Present before/after for PM validation

```markdown
| Requirement | S | M | A | R | T | Score | Action |
|-------------|---|---|---|---|---|-------|--------|
| [FR-001] | ✅ | ❌ | ✅ | ✅ | ❌ | 3/5 | Reformulated → [new version] |
```

**Seuil** : Toute exigence <4/5 est reformulée. PM valide ou ajuste.

### Step 4: Implementation Leakage Detection

> Detect technology names in functional requirements. A PRD describes WHAT, not HOW.

Scan all functional requirements for:

- Technology names (React, PostgreSQL, Redis, AWS...)
- Implementation patterns (REST API, microservice, queue...)
- Architecture decisions disguised as requirements

For each leakage found:

```markdown
| Exigence | Terme technique détecté | Reformulation fonctionnelle |
|----------|------------------------|----------------------------|
| [FR-XXX] | "REST API" | "Interface programmatique permettant..." |
```

**Règle** : Zéro nom de technologie dans les Functional Requirements. Reformuler directement.

### Step 5: Coherence & Traceability

> Verify bidirectional traceability: Feature ↔ JTBD ↔ Persona ↔ Story

If DISCOVERY_PACKAGE and/or USER_STORIES exist:

1. Map each PRD feature → Persona + JTBD
2. Map each JTBD → PRD feature (reverse check)
3. If backlog exists: map Story → PRD feature

Identify orphans:

- **Feature sans JTBD** → Justifier ou supprimer
- **JTBD sans Feature** → Gap fonctionnel à couvrir
- **Story sans Feature PRD** → Scope creep potentiel

### Step 6: Generate Gap Report

1. Generate structured Gap Report using template: @{{DOCS}}/templates/pm/gap_report.md
2. Include all dimensions: functional gaps + SMART scoring + leakage + traceability
3. For each gap, indicate if it was **fixed directly** or **needs PM decision**
4. Save to `{{DOCS}}/internal/product/GAP_REPORT.md`

### Step 7: Display Summary & Next Actions

```text
✅ Gap Analysis Complete

📊 Results:
- Gaps found: X (Y critical, Z important)
- SMART reformulations: X requirements improved
- Implementation leakage: X terms cleaned
- Traceability orphans: X items

🔧 Fixed directly:
- [list of auto-fixes applied]

⚠️ Needs PM decision:
- [list of items requiring human input]

📁 Output: {{DOCS}}/internal/product/GAP_REPORT.md

➡️ Next: Review fixes, resolve PM decisions, then /implementation_readiness
```

**WAIT FOR USER VALIDATION** before applying fixes.

## Quality Checklist

- [ ] All 6 functional gap types analyzed
- [ ] All key requirements SMART-scored
- [ ] All technology leakage detected and reformulated
- [ ] Bidirectional traceability verified (if docs exist)
- [ ] Each gap has severity + action (fix or PM decision)
- [ ] Gap Report generated with all dimensions
