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

- Edit durable, authored Markdown individually; exclude history, generated content and fixtures.
- Architecture: components, boundaries, flows, invariants. README: purpose, usage, limits.
- Use descriptive, hierarchical headings; include only relevant facts, once per document.
- Preserve contracts, decisions, rationale, limits, procedures, linked anchors and generator markers. Keep memory safeguards self-contained; never invent performance requirements.
- Remove filler, repetition, narrated history, dates, counters, ticket/run IDs, snapshots, temporary evidence and measured timings, ratios or comparisons.
- Keep required versions and constants; use examples and diagrams only to clarify.
- State actions and verification commands; link canonical sources for supporting details.
- Read back: check section scope, preserved information, commands and links.
