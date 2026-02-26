---
name: architecture-impact
description: >-
  Analyzes the precise impact of a brownfield change on existing architecture.
  Use when you need to map impacted modules and plan migrations for an evolution.
---

# Architecture Impact

## Goal

Map every module, service, and data structure impacted by a brownfield change, choose an evolution strategy, and plan reversible migrations.

## Rules

- Trace impact through direct, indirect, and transitive dependencies
- Every migration must be reversible (rollback plan mandatory)
- Zero-downtime migrations by default, justify any downtime
- Breaking changes require explicit versioning strategy
- Requirements started from $ARGUMENTS

## Quick Start

```text
Analyze the architecture impact of adding multi-tenant support
```

## Workflow

```mermaid
flowchart LR
    A[Read change brief] --> B[Identify impacted modules] --> C[Impact tree diagram] --> D[Evolution strategy] --> E[Migration plan] --> F[API versioning] --> G[Challenge gate] --> H[Save architecture-impact.md]
```

### Step 1: Identify Impacted Modules

**Do:**

1. Read the change brief/PRD and system overview
2. If `architecture.md` exists, read it to understand initial design decisions and their constraints — use this to assess whether the proposed change aligns with or diverges from existing architectural rationale
3. Identify all impacted modules:
   - **Direct**: modules that are modified
   - **Indirect**: modules that depend on modified ones
   - **Transitive**: modules that depend on indirect ones

**Success criteria:** All impacted modules identified at all dependency levels

### Step 2: Document Impact

**Do:**

1. Generate an impact tree diagram (Mermaid) with severity coloring
2. For each impacted module, document:
   - Type of impact (modification, interface change, behavior change)
   - Files concerned (estimated count)
   - Tests to adapt
   - Risk level (high/medium/low)

**Success criteria:** Impact tree complete, all modules documented with risk levels

### Step 3: Choose Strategy & Plan Migrations

**Do:**

1. Classify each change as breaking or non-breaking:
   - **Breaking**: removes or renames a public interface, changes behavior of existing endpoints, modifies data format, drops backward compatibility
   - **Non-breaking**: adds new endpoints/fields, extends behavior without changing existing contracts
   - For breaking changes: define versioning strategy (URL versioning, header versioning, sunset period) and stakeholder communication timeline
2. Choose evolution strategy using decision tree:
   - Feature Flags → for reversible changes on critical flows
   - Strangler Fig → for complete module replacement
   - Branch by Abstraction → for interface refactoring
   - Big Bang → only for simple, isolated changes
3. Plan data migrations at strategy level (if any):
   - Incremental phases (add → dual-write → backfill → switch → cleanup)
   - Rollback strategy for each phase
   - Zero-downtime validation approach
   - No SQL scripts or implementation code — describe the strategy, not the queries

**Success criteria:** Strategy chosen and justified, migration plan with rollback procedures

### Step 4: Challenge Gate

**Do:**

1. Verify the impact analysis against these criteria:
   - All impacted modules identified at every dependency level (direct, indirect, transitive)
   - Impact tree complete with severity coloring per module
   - Breaking changes classified with versioning strategy and communication timeline
   - Evolution strategy chosen and justified (Feature Flags / Strangler Fig / Branch by Abstraction / Big Bang)
   - Migration plan includes rollback procedure for each phase
   - Zero-downtime validated (or downtime justified and communicated)

**Success criteria:** All criteria pass. If any criterion fails, STOP — list each failing criterion with what is missing or incorrect. Iterate with the user until every criterion passes. Do NOT proceed to the next step until the gate is fully passed.

### Step 5: Save

**Do:**

1. Save as `{{DOCS}}/tasks/YYYY-MM-DD-{change-name}/architecture-impact.md`

**Success criteria:** File saved and accessible

## Resources

| Type  | Path                                           | Description                                  |
| ----- | ---------------------------------------------- | -------------------------------------------- |
| Input | `{{DOCS}}/memory/internal/system_overview.md`  | System overview                              |
| Input | `{{DOCS}}/memory/internal/architecture.md`     | Initial architecture decisions (if available) |
