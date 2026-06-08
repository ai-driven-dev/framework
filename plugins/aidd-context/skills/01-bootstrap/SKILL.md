---
name: 01-bootstrap
description: Imagine and validate the technical architecture of a new SaaS through interactive Q&A, candidate-stack comparison, multi-agent audit, and two project-root documents - `INSTALL.md` (the technologies installed, why they were chosen, and how to install them) and a `README.md`. Use when starting a new SaaS project, choosing a stack, designing the architecture pattern (monolith vs microservices vs serverless), or producing a project's INSTALL.md. Do NOT use for editing an existing project's stack, database schema design, or scaffolding actual files (this skill produces docs only, no code).
---

# Bootstrap

Technical architect for a new SaaS. Walks user through a 24-item checklist (18 user-input + 6 derived), proposes 2-3 candidate stacks, audits each via parallel agents, then produces project-root `INSTALL.md` (technologies, why chosen, how to install) and `README.md`. Docs only - no source code, no scaffolding.

## Available actions

| #   | Action                | Role                                                           | Input              |
| --- | --------------------- | -------------------------------------------------------------- | ------------------ |
| 01  | `gather-needs`        | Q&A across the 24-item checklist                               | user intent        |
| 02  | `propose-candidates`  | Derive 2-3 candidate stacks, render comparison table           | filled checklist   |
| 03  | `audit-candidates`    | Spawn parallel agents to validate each candidate, emit verdict | candidates table   |
| 04  | `pick-and-design`     | User picks winning stack; fill block-4 stack choices           | audit report       |
| 05  | `decide-architecture` | Fact-checked top-3 architecture patterns, human-picked; Mermaid module diagram | chosen stack + needs |
| 06  | `write-install-md`    | Produce `INSTALL.md` + project-root `README.md`     | design + decisions |

## Default flow

`01 → 02 → 03 → 04 → 05 → 06`. Sequential. Audit (03) is a gate: if every candidate returns `❌`, loop back to 02 (revise candidates) or 01 (revisit needs). Architecture decision (05) is a human-validation gate on a fact-checked top-3.

## Transversal rules

- **Docs only, no code scaffolding.** Writes `INSTALL.md` and project-root `README.md`. Never creates `package.json`, source files, or empty directories.
- **Anti-sycophancy.** When user stack preference conflicts with needs (e.g. wants Mongo for heavily relational data), challenge before accepting: surface audit concerns, ask for mitigation plan.
- **Recommend opinionated, not encyclopedic.** Each action proposes 2-3 options max, never a long catalog. User leaves with a concrete decision, not a research paper.
- **Stop on full checklist.** Action 01 keeps asking until the 18 user-input items (blocks 1-3) are filled - plus selected building blocks; the 6 derived items (block 4) are filled across actions 02, 04, 05 (architecture pattern).
- **Apply heuristics from `@references/stack-heuristics.md`** when proposing candidates.

## References

- `@references/stack-heuristics.md` - input → recommended-stack-family heuristics

## Assets

- `@assets/checklist.md` - the 24-item checklist (4 blocks)
- `@assets/INSTALL.md` - the `INSTALL.md` skeleton (technologies, why chosen, how to install)
- `@assets/README.md` - the project-root `README.md` template

## External data

- `aidd-context/skills/04-mermaid/SKILL.md` - invoked from action 05 to render the architecture diagram
