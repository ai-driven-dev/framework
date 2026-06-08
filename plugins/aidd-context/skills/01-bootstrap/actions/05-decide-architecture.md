# 05 - Decide architecture

Propose modern, effective architecture patterns for chosen stack + needs as a fact-checked top-3; human picks one; derive module diagram.

## Inputs

- Chosen stack (block 4 stack items, from action 04).
- Filled checklist blocks 1-3 (needs and constraints).

## Outputs

Two artifacts held in conversation context (not yet written to disk):

1. Checklist with **block 4's architecture-pattern item filled** (human-picked winner).
2. Mermaid diagram showing modules and relations.

```markdown
## Architecture top-3 (for Next.js + Postgres, relational domain)

| # | Pattern            | Why it fits                                              |
| - | ------------------ | ------------------------------------------------------- |
| 1 | Modular monolith   | One deploy, clear module seams, easiest to evolve later |
| 2 | Clean architecture | Strong boundaries, swappable infra, more upfront cost   |
| 3 | Vertical slice     | Feature-first, low ceremony, weaker shared-core control |
```

## Depends on

- `04-pick-and-design`

## Process

1. **Fact-check first.** Before proposing, verify candidate patterns are current best practice for this stack: discover a fact-check capability by matching loaded-skill descriptions for keywords such as `verify factual claims against authoritative sources`, `cite your sources` (do not match by hardcoded skill name), or spawn an audit agent as action 03 does. Discard anything stale.
2. Propose a **top-3** of architecture patterns ranked for chosen stack + needs, each with a one-line rationale. Opinionated, max 3 - never a catalogue. Apply heuristics from `@../references/stack-heuristics.md`.
3. **Human validation gate.** User picks one of the three (or asks to revise). Do not proceed on silence.
4. Fill block 4's architecture-pattern item with the picked winner.
5. Derive high-level modules from chosen pattern + selected building blocks (a module per block, plus the pattern's standard divisions). Concrete folder tree is the scaffold's job - not part of the ADR.
6. Generate the Mermaid module diagram by invoking `aidd-context:04-mermaid` with those modules and relations. Verify it parses (no parser errors).
7. Print top-3 rationale, chosen pattern, and diagram together. Wait for user confirmation before action 06.

## Test

A fact-checked top-3 of architecture patterns was presented; user picked one in writing; block 4's architecture-pattern item is filled with no `<...>` placeholder; a ` ```mermaid ` block is present and parses without error.
