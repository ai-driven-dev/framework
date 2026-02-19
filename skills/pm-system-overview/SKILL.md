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

## Quick Start

```text
Analyze the existing system and create a system overview
```

## Workflow

```mermaid
flowchart LR
    A[Scan project] --> B[Identify modules] --> C[Map flows] --> D[Detect pain points] --> E[Generate overview] --> F[Review] --> G[Save system_overview.md]
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

### Step 3: Generate & Review

**Do:**

1. Generate a system overview with Mermaid diagrams
2. Present findings with confidence levels
3. **WAIT FOR USER REVIEW**
4. Save as `{{DOCS}}/memory/internal/system_overview.md`

**Success criteria:** System overview validated and saved

## Resources

| Type   | Path                                       | Description             |
| ------ | ------------------------------------------ | ----------------------- |
| Output | `{{DOCS}}/memory/internal/system_overview.md`     | Generated overview      |

### Output Template

```markdown
# System Overview - [Project Name]

## Tech Stack
[Languages, frameworks, versions, infrastructure]

## Main Modules
[Table + Mermaid diagram of modules and their relationships]

## Critical Flows
[Sequence diagrams for each critical flow]

## Dependencies
### Internal
[Module dependency table with coupling levels]
### External
[Third-party services with versions and alternatives]

## Pain Points
[Prioritized table: severity, business impact, affected modules]

## Known Limitations
[What the system cannot do today]

## Key Metrics
[Performance, availability, usage if available]
```
