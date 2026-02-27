---
name: 'ux-audit'
description: 'Audits UX against Nielsen''s 10 heuristics with severity scoring and prioritization matrix. Use when you need to evaluate an existing product''s usability and identify improvements.'
---

# UX Audit

## Goal

Evaluate an existing product against Nielsen's 10 usability heuristics. Produce a scored audit with severity levels and a prioritization matrix that ranks issues by impact and effort. The output is an actionable improvement backlog.

## Rules

- All 10 Nielsen heuristics must be evaluated — no shortcuts
- Severity scoring uses a 0-4 scale (0=not a problem, 4=usability catastrophe)
- Every issue must have a concrete recommendation, not just a diagnosis
- Prioritization uses impact vs effort matrix
- Evidence-based — cite specific screens, flows, or code patterns
- Requirements started from $ARGUMENTS
- **Standalone usage** — when invoked directly (not through an agent), present the deliverable and ask for user approval

## Quick Start

```text
Audit the UX of our application
```

## Workflow

```mermaid
flowchart LR
    A[Gather inputs] --> B[Evaluate 10 heuristics] --> C[Score severity] --> D[Prioritization matrix] --> E[Recommendations] --> F[Challenge gate] --> G[Save ux-audit.md]
```

### Step 1: Gather Inputs

**Do:**

1. Read the codebase, screenshots, or existing documentation from $ARGUMENTS
2. Identify the key user flows to audit
3. List the screens and interactions to evaluate

**Success criteria:** Audit scope defined with specific flows and screens

### Step 2: Evaluate Nielsen's 10 Heuristics

**Do:**

4. Evaluate each heuristic with specific findings:
   - **H1 — Visibility of system status**: Does the system keep users informed?
   - **H2 — Match between system and real world**: Does it use user language?
   - **H3 — User control and freedom**: Can users undo and redo?
   - **H4 — Consistency and standards**: Are conventions followed?
   - **H5 — Error prevention**: Does the design prevent errors?
   - **H6 — Recognition rather than recall**: Is information visible vs memorized?
   - **H7 — Flexibility and efficiency of use**: Are there shortcuts for experts?
   - **H8 — Aesthetic and minimalist design**: Is information relevant?
   - **H9 — Help users recognize, diagnose, and recover from errors**: Are error messages helpful?
   - **H10 — Help and documentation**: Is help available when needed?
5. For each finding, document: location, description, evidence

**Success criteria:** All 10 heuristics evaluated with specific findings

### Step 3: Severity Scoring & Prioritization

**Do:**

6. Score each finding on a 0-4 severity scale:
   - 0: Not a usability problem
   - 1: Cosmetic — fix only if extra time
   - 2: Minor — low priority fix
   - 3: Major — high priority fix
   - 4: Catastrophe — must fix before release
7. Build a prioritization matrix (impact vs effort):
   - Quick wins: high impact, low effort
   - Strategic: high impact, high effort
   - Fill-ins: low impact, low effort
   - Deprioritize: low impact, high effort

**Success criteria:** All findings scored and plotted on the prioritization matrix

### Step 4: Challenge Gate

**Do:**

8. Verify the UX audit against these criteria:
   - All 10 Nielsen heuristics evaluated with specific findings (no heuristic skipped)
   - Severity scored on 0-4 scale for every finding
   - Prioritization matrix (impact × effort) complete with all findings plotted
   - Every finding has a concrete, actionable recommendation (not just a diagnosis)
   - Evidence-based: specific screens, flows, or code patterns cited for each finding

**Success criteria:** All criteria pass. If any criterion fails, STOP — list each failing criterion with what is missing or incorrect. Iterate with the user until every criterion passes. Do NOT proceed to the next step until the gate is fully passed.

### Step 5: Save

**Do:**

9. Save as `aidd_docs/tasks/YYYY-MM-DD-{audit}/ux-audit.md`

**Success criteria:** File saved and accessible

## Resources

| Type  | Path                                            | Description              |
| ----- | ----------------------------------------------- | ------------------------ |
| Input | Codebase or screenshots                         | Product to audit         |
| Input | `aidd_docs/memory/internal/design_system.md`           | Design system (if exists)|
| Input | `aidd_docs/memory/internal/user_flows.md`              | User flows (if exists)   |
