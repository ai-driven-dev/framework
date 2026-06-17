# 03 - Choose stack

Propose candidate stacks, audit them, let the user pick, and settle the architecture pattern. Pure decision-making - writes nothing to disk (that is `04-init-install-md`).

## Inputs

- Gathered needs + building blocks (from `02-gather-needs`).
- `@../references/stack-heuristics.md`.

## Process

1. Derive 2-3 candidate stacks from the needs using the heuristics; they must span the trade-off space (hosting model / back-end language / pattern). Render a comparison table (front, back, DB, hosting, auth, pattern, cost, risks).
2. **Audit each candidate in parallel** (one agent per candidate): tech compatibility, ecosystem maturity, known gotchas → verdict ✅ / ⚠️ / ❌ + a 3-bullet rationale. If every candidate is ❌, revise the candidates and re-audit.
3. **User picks the winner** by letter. Refuse a ❌ pick; for a ⚠️ pick, surface the risks and require a mitigation.
4. Settle the **architecture pattern** for the chosen stack (fact-checked top-3, user picks one), then derive the high-level modules and a Mermaid diagram (via the mermaid capability).

## Test

- [ ] A comparison table with ≥2 audited candidates; user picked a non-❌ winner in writing; an architecture pattern is chosen; a Mermaid diagram parses without error.
