---
name: analyze_raw_data
description: Extract insights with triangulation
argument-hint: transcripts, notes, feedback files
---

# Analyze Raw Data

## Goal

Extract **validated insights** from data sources.

## Rules

- **Triangulation**: 2/3+ sources → ✅ Verified
- 1 strong source → 🟡 Probable
- Weak/contradictory → ❌ Uncertain
- **Never invent quotes**

## Context

```text
$ARGUMENTS
```

## Steps

1. Parse sources by type
2. Extract: verbatims, pain points, behaviors, emotions
3. Cluster themes (count frequency)
4. Rank pain points: severity × frequency
5. Detect workarounds
6. Identify user profiles
7. Flag contradictions
8. Output Insights Report
