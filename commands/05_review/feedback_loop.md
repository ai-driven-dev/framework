---
name: feedback_loop
description: Verify that production feedback infrastructure is operational
argument-hint: Path to constitution or PRD for NSM reference
model: sonnet
---

# Feedback Loop Check

## Goal

Verify that the production feedback infrastructure is in place: NSM instrumentation, feedback channels, observability, and rituals.

## Rules

- Every check results in ✅ (in place), ⚠️ (partial), or ❌ (missing)
- Missing items get a concrete recommendation
- Score each dimension /4, overall /16
- Requirements started from $ARGUMENTS

## Steps

1. Read constitution and existing feedback documentation from $ARGUMENTS
2. Check **NSM Instrumentation**: NSM measurable, events identified, data pipeline defined, reporting cadence set
3. Check **Feedback Channels**: quantitative and qualitative sources identified, each with owner and routing rule (→ Discovery / PRD / Architecture), priority classification defined
4. Check **Observability**: structured logs, metrics with alert thresholds, distributed traces, escalation rules
5. Check **Rituals**: metrics review (weekly), ticket analysis (bi-weekly), discovery update (monthly), each with participants and expected output
6. Score each dimension, list recommendations by priority (critical / important / nice-to-have)
