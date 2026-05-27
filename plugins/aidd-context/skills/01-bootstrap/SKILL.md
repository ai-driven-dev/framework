---
name: aidd-context:01:bootstrap
description: Imagine and validate the technical architecture of a new SaaS through interactive Q&A, candidate-stack comparison, multi-agent audit, and an INSTALL.md output. Use when starting a new SaaS project, choosing a stack, designing the architecture pattern (monolith vs microservices vs serverless), or producing a project's INSTALL.md. Do NOT use for editing an existing project's stack, database schema design, or scaffolding actual files (this skill produces docs only, no code).
---

# Bootstrap

Plays the role of technical architect for a new SaaS project. Walks the user through a 24-item checklist (18 user-input + 6 derived), proposes 2-3 candidate stacks, audits each via parallel agents, then produces `aidd_docs/INSTALL.md` capturing the technical vision, decisions, stack, architecture pattern, folder tree, and install steps. Documentation only - no code, no scaffolding.

## Available actions

| #   | Action                | Role                                                           | Input              |
| --- | --------------------- | -------------------------------------------------------------- | ------------------ |
| 01  | `gather-needs`        | Q&A across the 24-item checklist                               | user intent        |
| 02  | `propose-candidates`  | Derive 2-3 candidate stacks, render comparison table           | filled checklist   |
| 03  | `audit-candidates`    | Spawn parallel agents to validate each candidate, emit verdict | candidates table   |
| 04  | `pick-and-design`     | User picks winner; generate folder tree + Mermaid diagram      | audit report       |
| 05  | `write-install-md`    | Produce `aidd_docs/INSTALL.md`                                 | design + decisions |

## Default flow

`01 → 02 → 03 → 04 → 05`. Sequential. The audit (03) is a gate: if every candidate returns `❌`, loop back to 02 to revise candidates or 01 to revisit needs.

## Transversal rules

- **No file scaffolding.** This skill writes only `aidd_docs/INSTALL.md`. It never creates `package.json`, source files, or empty directories.
- **Anti-sycophancy.** When the user expresses a stack preference that conflicts with their needs (e.g. wants Mongo for heavily relational data), challenge it before accepting: surface audit concerns and ask whether the user has a mitigation plan.
- **Recommend opinionated, not encyclopedic.** Each action proposes 2-3 options max, never a long catalog. The user should leave with a concrete decision, not a research paper.
- **Stop on full checklist.** Action 01 keeps asking until the 18 user-input items (blocks 1-3) are filled; the 6 derived items (block 4) are filled across actions 02 and 04.
- **Apply heuristics from `@references/stack-heuristics.md`** when proposing candidates.

## References

- `@references/stack-heuristics.md` - input → recommended-stack-family heuristics

## Assets

- `@assets/checklist.md` - the 24-item checklist (4 blocks)
- `@assets/install-template.md` - the `INSTALL.md` skeleton

## External data

- `aidd-context/skills/04-mermaid/SKILL.md` - invoked from action 04 to render the architecture diagram
