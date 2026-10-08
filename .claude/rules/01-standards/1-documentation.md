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

- Apply only to durable, authored Markdown.
- Revise existing documents individually.
- Exclude historical, generated, and fixture content.
- Preserve contracts, decisions, limits, and procedures.
- Architecture explains components, boundaries, flows, invariants.
- README explains purpose, usage, and limits.
- Give each section a clear purpose and descriptive heading.
- Put only relevant information under that heading; place each fact once per document.
- Group related sections under a shared parent; avoid headings that add no structure.
- State actions and verification commands.
- Link canonical sources for supporting details.
- Keep memory's operational safeguards self-contained.
- Remove filler, repetition, and narrated history.
- Exclude dates, counters, ticket/run identifiers.
- Exclude snapshots and temporary evidence.
- Drop measured timings, ratios, and comparisons.
- Keep rationale; never invent performance requirements.
- Retain required versions, constants, and examples.
- Use examples and diagrams only to clarify.
- Preserve linked anchors and generator markers when restructuring.
- Read back; check section scope, contracts, and commands.
- Verify links before declaring completion.
