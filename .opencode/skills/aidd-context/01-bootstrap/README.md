← [aidd-framework](../../../../README.md) / [aidd-context](../../README.md)

# 01 - Bootstrap

Plays the role of technical architect for a new SaaS project. Walks the user
through a 24-item checklist, proposes 2-3 candidate stacks, audits each via
parallel agents, then produces `aidd_docs/INSTALL.md` capturing the technical
vision, decisions, stack, architecture pattern, folder tree, and install
steps. Documentation only - no code, no scaffolding.

## When to use

- Starting a brand-new SaaS project and choosing a stack.
- Deciding the architecture pattern (monolith vs microservices vs serverless).
- Producing a project's `INSTALL.md` from a fresh idea.

## When NOT to use

- To edit an existing project's stack (the audit is too heavy for one
  swap-out).
- For database schema design or detailed data modeling.
- To scaffold actual files - this skill produces docs only.

## How to invoke

```
Use skill aidd-context:01:bootstrap
```

The skill walks 5 atomic actions in sequence:

1. `gather-needs` - Q&A across the 24-item checklist (18 user-input, 6
   derived).
2. `propose-candidates` - derive 2-3 candidate stacks and render a
   comparison table.
3. `audit-candidates` - spawn parallel agents to validate each candidate
   and emit a verdict; if every candidate fails, loop back to `02` or `01`.
4. `pick-and-design` - user picks the winner, then generate the folder tree
   and a Mermaid architecture diagram.
5. `write-install-md` - produce `aidd_docs/INSTALL.md`.

## Outputs

- `aidd_docs/INSTALL.md` capturing vision, decisions, chosen stack,
  architecture pattern, folder tree, install steps, and a Mermaid diagram.

## Prerequisites

- A clear (or at least loosely-formed) product idea to discuss.
- A working directory where `aidd_docs/INSTALL.md` can be written.

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract, [`actions/`](actions/)
for each step, `references/stack-heuristics.md` for the input → recommended
stack-family heuristics, and `assets/checklist.md` + `assets/install-template.md`
for the canonical 24-item checklist and `INSTALL.md` skeleton. The Mermaid
architecture diagram in action 04 is rendered via the sibling
`04-mermaid` skill.
