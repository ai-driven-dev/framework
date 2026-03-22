---
name: milestones
description: Architecture milestones template — ordered implementation plan from epics to delivery
argument-hint: N/A
---

# Milestones — [Project Name]

**Version**: [X.Y]
**Generated from**: `prd.md` + `architecture.md`
**Total estimated duration**: [n weeks]

## Overview

```mermaid
gantt
    title Implementation Plan
    dateFormat  YYYY-MM-DD
    section M1 Foundation
    [Epic 1]    :m1-1, YYYY-MM-DD, Xd
    section M2 Core
    [Epic 2]    :m2-1, after m1-1, Xd
    section M3 Launch
    [Epic 3]    :m3-1, after m2-1, Xd
```

## Critical Path

```mermaid
flowchart LR
    M1["M1: Foundation"] --> M2["M2: Core Features"]
    M2 --> M3["M3: Polish & Launch"]
```

## Milestones

### M1 — [Milestone name]

**Objective**: [What this milestone achieves]
**Duration**: [n weeks]
**Target date**: [YYYY-MM-DD]

| Epic | Stories | Estimate | Dependencies |
| --- | --- | --- | --- |
| [Epic name] | [US-01, US-02] | [Xd] | [None / M0] |

**GO/NO-GO criteria**:
- [ ] [Criterion 1]
- [ ] [Criterion 2]

---

### M2 — [Milestone name]

**Objective**: [What this milestone achieves]
**Duration**: [n weeks]
**Target date**: [YYYY-MM-DD]

| Epic | Stories | Estimate | Dependencies |
| --- | --- | --- | --- |
| [Epic name] | [US-03, US-04] | [Xd] | [M1] |

**GO/NO-GO criteria**:
- [ ] [Criterion 1]
- [ ] [Criterion 2]

---

### M3 — [Milestone name]

**Objective**: [What this milestone achieves]
**Duration**: [n weeks]
**Target date**: [YYYY-MM-DD]

| Epic | Stories | Estimate | Dependencies |
| --- | --- | --- | --- |
| [Epic name] | [US-05, US-06] | [Xd] | [M2] |

**GO/NO-GO criteria**:
- [ ] [Criterion 1]
- [ ] [Criterion 2]

## Risks & Buffers

| Risk | Milestone | Probability | Buffer allocated |
| --- | --- | --- | --- |
| [Risk description] | [M1/M2/M3] | [High/Med/Low] | [+n days] |

## Constitution Constraint Validation

| Constraint | Respected in plan? | Notes |
| --- | --- | --- |
| [Constraint from constitution] | [Yes/No] | [How] |
