---
name: generate_jtbd
description: Formulate JTBD from personas
argument-hint: (uses previous personas)
model: sonnet
---

# Generate JTBD

## Goal

Create **JTBD with emotional dimension**.

## Rules

- Template: `@{{DOCS}}/templates/pm/jtbd.md`
- Map each JTBD to persona
- Attach evidence

## Steps

1. Load personas + insights
2. Per need:
   - **When** [situation]
   - **I want** [capability]
   - **So that** [goal]
   - **And feel** [emotion]
3. Attach verbatim/metric
4. Output JTBD list
