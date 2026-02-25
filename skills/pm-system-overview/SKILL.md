---
name: pm-system-overview
description: >-
  Analyzes an existing codebase and generates a pragmatic system overview.
  Use when starting a brownfield project to understand the current system state.
---

# Create System Overview

## Goal

Create a pragmatic, up-to-date overview of an existing system by analyzing the codebase, documentation, and project structure.

## Rules

- Base analysis on actual code, not assumptions
- Mark uncertain information with confidence levels (Verified, Probable, Uncertain)
- Focus on what matters for evolution decisions
- Keep the document actionable, not exhaustive
- This is a living document that should be updated regularly
- **Drift detection** — if `architecture.md` exists, compare it against the actual codebase. Flag discrepancies between documented architecture and implemented reality (outdated tech versions, missing modules, undocumented services).
- **Standalone usage** — when invoked directly (not through an agent), present the deliverable and ask for user approval

## Quick Start

```text
Analyze the existing system and create a system overview
```

## Workflow

```mermaid
flowchart LR
    A[Scan project] --> B[Identify modules] --> C[Map flows] --> D[Detect pain points] --> E[Challenge gate] --> F[Generate overview] --> G[Save system_overview.md]
```

### Step 1: Scan & Analyze

**Do:**

1. Scan the project structure, tech stack, and dependencies
2. Identify main modules and their responsibilities
3. Map critical flows (authentication, core business logic, data persistence)
4. Identify internal and external dependencies with coupling levels

**Success criteria:** All modules, flows, and dependencies mapped

### Step 2: Detect Issues

**Do:**

1. Detect pain points from code patterns (duplication, complexity, outdated dependencies)
2. Document known limitations

**Success criteria:** Pain points identified and prioritized

### Step 3: Challenge Gate

**Do:**

1. Read the template from Resources
2. Verify every template section exists in the output with the exact same heading name and no section was added beyond what the template defines
3. Verify format requirements:
   - Confidence levels (Verified/Probable/Uncertain) annotated on findings

**Success criteria:** All template sections present and format requirements met. If any section is missing or any format is wrong, STOP — fix it. Do NOT proceed until structurally complete.

### Step 4: Generate & Save

**Do:**

1. Read the template from Resources. Follow its exact structure — same headings, same table columns, same formats. Do not add, remove, or rename sections.
2. Generate a system overview with Mermaid diagrams
3. Save as `{{DOCS}}/memory/internal/system_overview.md`

**Success criteria:** File saved and accessible

## Resources

| Type     | Path                                              | Description        |
| -------- | ------------------------------------------------- | ------------------ |
| Output   | `{{DOCS}}/memory/internal/system_overview.md`     | Generated overview |
| Template | `{{DOCS}}/templates/pm/system_overview.md`        | Overview template  |
