---
name: gap_analysis
description: Analyze specifications for gaps, inconsistencies and missing elements
argument-hint: Path to PRD or specifications to analyze
model: opus
---

# Gap Analysis

## Goal

Detect inconsistencies, gaps, and missing elements in project specifications before development starts.

## Rules

- Every finding must be classified by severity (Critical, Important, Nice-to-have)
- False positives must be filtered with VIBE Check (Verify, Interpret, Bias, Enhance)
- PRD ↔ User Stories alignment must be verified
- GDPR compliance must be checked
- Requirements started from $ARGUMENTS

## Context

### Gap Report Template

```markdown
@{{DOCS}}/templates/pm/gap_report.md
```

## Steps

1. Read the specifications from $ARGUMENTS
2. Analyze for gaps across these dimensions:
   - **Functional gaps**: missing features, undefined behaviors, unclear flows
   - **Non-functional gaps**: performance, security, scalability undefined
   - **Consistency gaps**: contradictions between sections
   - **Traceability gaps**: features without user stories or vice versa
   - **Edge case gaps**: unhandled scenarios, error states
   - **Security/GDPR gaps**: data protection, consent, right to delete
   - **Implementation leakage**: specs that pre-decide technical solutions
3. Classify each gap by severity:
   - 🔴 **Critical**: blocks development
   - 🟡 **Important**: must resolve before delivery
   - 🟢 **Nice-to-have**: can be deferred
4. Apply VIBE Check to eliminate false positives:
   - **V**erify: is this really a gap or a deliberate choice?
   - **I**nterpret: am I reading this correctly?
   - **B**ias: am I bringing my own assumptions?
   - **E**nhance: can I suggest a better formulation?
5. Present findings in a structured report
6. **WAIT FOR USER REVIEW**
7. Save as `aidd_docs/tasks/gap-analysis-[date].md`

## Output

```markdown
# Gap Analysis Report

## Summary
- Critical gaps: [count]
- Important gaps: [count]
- Nice-to-have: [count]

## Critical Gaps
| # | Gap | Impact | Recommendation |
| --- | --- | --- | --- |
| 1 | ... | ... | ... |

## Important Gaps
| # | Gap | Impact | Recommendation |
| --- | --- | --- | --- |

## Nice-to-have Gaps
| # | Gap | Impact | Recommendation |
| --- | --- | --- | --- |

## PRD Quality Dimensions
| Dimension | Score /10 | Details |
| --- | --- | --- |
| Completeness | ... | ... |
| Consistency | ... | ... |
| Testability | ... | ... |
| Traceability | ... | ... |

## Remediation Tracking
| # | Gap | Owner | Status | Due Date |
| --- | --- | --- | --- | --- |
```
