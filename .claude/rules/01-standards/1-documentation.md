---
paths:
  - "**/README.md"
  - "**/ARCHITECTURE.md"
  - "docs/**/*.md"
  - "**/aidd_docs/memory/**/*.md"
  - "**/GUIDELINES.md"
  - "**/CONTRIBUTING.md"
---

# Concise documentation

- Scope: authored Markdown. Skip history, generated blocks and fixtures.
- README: purpose, usage, limits. Architecture: components, boundaries, flows, invariants.
- No prose: tables, lists, diagrams and code.
- One sentence per bullet or cell, 25 words at most.
- Tables for roles, diagrams for relationships.
- One fact, one home: link the file that owns it.
- Detail fits the place: a README links, the owner holds the detail.
- Keep contracts, decisions, rationale, limits, procedures, anchors and generator markers.
- Keep memory safeguards self-contained.
- Keep required versions, constants and useful examples.
- Drop filler, narrated history, plans, snapshots and measured timings or comparisons.
- No counts, except one a generator rewrites or the owner keeps in sync.
- Never invent a performance requirement.
- State each action with its verification command.
- Read back: section scope, facts kept, commands and links.
