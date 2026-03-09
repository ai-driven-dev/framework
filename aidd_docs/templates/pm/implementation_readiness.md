---
name: implementation_readiness
description: Template for implementation readiness checklist and Go/No-Go decision
argument-hint: N/A
---

# Implementation Readiness - [Project Name]

## Summary

| Field | Value |
|-------|-------|
| Date | !`date +%Y-%m-%d` |
| Evaluated by | [Name] + AI |
| Decision | **GO** / **NO-GO** / **CONDITIONAL GO** |
| Blocking score | X/7 PASS |
| Important score | X/6 PASS (>80% required) |

---

## Blocking Criteria (must be 7/7)

> ⚠️ If ANY criterion fails, decision is **NO-GO** — Return to specification phase.

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | **Strategic fit validated (RICE/OKRs)** | ✅ PASS / ❌ FAIL | RICE score: R=[X] I=[X] C=[X]% E=[X] / OKR alignment: [reference] |
| 2 | **Pre-Code validation (Prototype tested)** | ✅ / ❌ | Prototype tested with X users (min 10-15) / Feedback: [summary] |
| 3 | **Core features specified + AC defined (Gherkin)** | ✅ / ❌ | [reference to FRs + user stories with Given-When-Then] |
| 4 | **Technical feasibility validated** | ✅ / ❌ | Architecture validated / No story >13 points / [reference] |
| 5 | **Dependencies resolved** | ✅ / ❌ | All external dependencies (APIs, teams) available / [list] |
| 6 | **Critical risks mitigated (Pre-Mortem)** | ✅ / ❌ | No High/High risks without mitigation plan / [reference to risk matrix] |
| 7 | **Success metrics + out-of-scope defined** | ✅ / ❌ | KPIs: [list] / Out of scope: [reference to PRD section 10] |

---

## Important Criteria (must be >80%)

> ℹ️ If <80%, decision is **CONDITIONAL GO** — Development can start with remediation plan.

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | NFRs specified (performance, security, scalability) | ✅ / ❌ | [reference] |
| 2 | Milestones ordered | ✅ / ❌ | [reference to roadmap] |
| 3 | Stories estimated (rough order of magnitude) | ✅ / ❌ | [reference to backlog] |
| 4 | MoSCoW prioritization applied | ✅ / ❌ | Must/Should/Could/Won't defined |
| 5 | Testing strategy defined | ✅ / ❌ | [reference to test plan] |
| 6 | Team skills validated (Skill Matrix) | ✅ / ❌ | [skill matrix with gaps identified] |

---

## Team Readiness

| Item | Status | Evidence | Risk |
|------|--------|----------|------|
| Team skills complete (skill matrix) | ✅ / ❌ | [skill matrix with React, Node.js, AWS, etc.] | [if gaps identified] |
| Key people available | ✅ / ❌ | [names + capacity %] | [if unavailable] |
| Sustainable velocity | ✅ / ❌ | Historical velocity: [X] pts/sprint × 70% focus factor | [if declining trend] |
| Team capacity calculated | ✅ / ❌ | Available hours: [X] / Sprint capacity: [X] story points | [if overcommitted] |

### Complexity Checks

- [ ] No story >13 points (if yes, split required)
- [ ] All stories have clear Definition of Ready (DoR)
- [ ] Dependencies mapped and resolved

---

## Risk Assessment (Pre-Mortem Analysis)

> 🎯 **AI-Assisted Pre-Mortem**: Use AI prompts to simulate failure scenarios before launch.

### Step 1: Risk Brainstorming (Divergence)

**AI Prompt**: "Act as a Project Risk Manager. Analyze the following project plan to launch [Feature]. Identify the 5 most critical risks that could cause project failure, categorized as: Technical, Operational, Business."

### Step 2: Risk Matrix (Convergence)

| Risk           | Category                   | Probability         | Impact                      | Mitigation Plan    | Owner | Status                                  |
|----------------|----------------------------|---------------------|-----------------------------|--------------------|-------|-----------------------------------------|
| [description]  | Technical / Business / User | High / Medium / Low | Blocked / Delayed / Quality | [specific actions] | [who] | ✅ Mitigated / ⚠️ Monitored / ❌ Open |

### Step 3: Critical Risk Validation

> ⚠️ **BLOCKING**: No High Probability + High Impact risks without mitigation plan.

- [ ] No High/High risks without mitigation
- [ ] Security review completed
- [ ] Performance tested at scale
- [ ] Dependency risks mitigated
- [ ] No show-stopper bugs open
- [ ] Ethical/bias risks assessed (for AI features)

---

## Lessons from Previous Cycles

| Learning | Catégorie | Appliqué à ce release |
|----------|-----------|-----------------------|
| [lesson] | process / technical / risk | [comment c'est adressé] |

---

## Remediation Plan

> Actions required before development can start.

| # | FAIL Criterion | Action | Owner | Deadline |
|---|----------------|--------|-------|----------|
| 1 | [criterion] | [action to resolve] | [who] | [when] |

---

## Decision

### Recommendation

- [ ] **GO** — All blocking criteria PASS (7/7), >80% important criteria PASS (5/6+)
- [ ] **NO-GO** — Blocking criteria FAIL, return to specification phase
- [ ] **CONDITIONAL GO** — Blocking PASS (7/7) but important criteria <80%, proceed with remediation plan

### Justification (Data Storytelling)

**Context**: [What was the objective?]

**Signal**: [What do the data show? (e.g., prototype adoption +22%, RICE score High/High)]

**Insight**: [Why is this happening? (e.g., retention dropping due to complex onboarding)]

**Decision**: [We launch / We delay / We launch with immediate fix]

### Stakeholder Communication (3C Framework)

> 🎯 Adapt message by role: C-Suite (Business Impact), Marketing/Sales (Timeline), Engineers (Technical Quality)

**Clarity**: [Decision in 1 sentence]

**Context**: [Why, with data supporting the decision]

**Confidence**: [Assert leadership and next steps]

### Next Steps

**If GO**:

- [ ] Schedule kick-off meeting
- [ ] Communicate timeline to stakeholders
- [ ] Prepare sprint 0 backlog

**If NO-GO**:

- [ ] Document blocking issues in remediation plan
- [ ] Return to oriane agent for specification refinement
- [ ] Schedule follow-up review date

**If CONDITIONAL GO**:

- [ ] Execute remediation plan in parallel with sprint 1
- [ ] Set review checkpoint for remaining criteria
- [ ] Monitor risks closely during initial sprint
