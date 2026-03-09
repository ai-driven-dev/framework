---
name: decision
description: Individual decision record template
argument-hint: <title>
---

# Decision: <title>

| Field   | Value          |
| ------- | -------------- |
| ID      | DEC-XXX        |
| Date    | !`date`        |
| Feature | <feature-name> |
| Status  | Accepted       |

## Context

<Why was this decision needed?>

## Decision

<What was decided?>

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| ----------- | ---- | ---- | ---------------- |
| <alt1>      | ...  | ...  | ...              |

## Consequences

<What are the results?>

<!--
IMPORTANT: THOSE ARE RULES FOR AI, DO NOT USE THOSE INTO FILLED TEMPLATE.

- ID: use format DEC-XXX, incrementing number for each new decision
- Date: use !`date` to get current date
- Feature: name of the feature or component this decision relates to
- Status: Accepted | Deprecated | Superseded by DEC-XXX
- Context: 2-3 sentences explaining why this decision was needed
- Decision: 1-2 sentences stating what was decided
- Alternatives: only include alternatives that were seriously considered
- Consequences: positive and negative outcomes of this decision
-->
