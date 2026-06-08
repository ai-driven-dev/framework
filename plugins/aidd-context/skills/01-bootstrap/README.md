← [aidd-framework](../../../../README.md) / [aidd-context](../../README.md)

# 01 - Bootstrap

Technical architect for a new SaaS project. Walks user through a 24-item checklist, proposes 2-3 candidate stacks, audits each via parallel agents, then produces a project-root `INSTALL.md` (ADR-style): technical vision, decisions, chosen stack, building blocks, architecture, install steps. Documentation only - no code, no scaffolding.

## When to use

- Starting a brand-new SaaS project and choosing a stack.
- Deciding the architecture pattern (monolith vs microservices vs serverless).
- Producing a project's `INSTALL.md` from a fresh idea.

## When NOT to use

- Editing an existing project's stack (audit too heavy for one swap-out).
- Database schema design or detailed data modeling.
- Scaffolding actual files - this skill produces docs only.

## How to invoke

```
Use skill aidd-context:01-bootstrap
```

The skill walks 6 atomic actions in sequence:

1. `gather-needs` - Q&A across the 24-item checklist (18 user-input, 6 derived) plus selected building blocks.
2. `propose-candidates` - derive 2-3 candidate stacks, render comparison table.
3. `audit-candidates` - spawn parallel agents to validate each candidate, emit verdict; if every candidate fails, loop back to `02` or `01`.
4. `pick-and-design` - user picks the winning stack.
5. `decide-architecture` - fact-checked top-3 patterns, human-picked, plus a Mermaid module diagram.
6. `write-install-md` - produce the project-root `INSTALL.md`.

## Outputs

- A project-root `INSTALL.md`: vision, decisions, chosen stack, building blocks, architecture (Mermaid diagram), install steps.

## Prerequisites

- A clear (or loosely-formed) product idea to discuss.
- A working directory where `INSTALL.md` can be written.

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract, [`actions/`](actions/) for each step, `references/stack-heuristics.md` for input → recommended stack-family heuristics, and `assets/checklist.md` + `assets/INSTALL.md` for the canonical 24-item checklist and `INSTALL.md` skeleton. The Mermaid architecture diagram in action 05 is rendered via the sibling `04-mermaid` skill.
