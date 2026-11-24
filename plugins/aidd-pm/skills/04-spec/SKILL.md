---
name: 04-spec
description: Drafts or refines a spec, a feature's locked contract, when the user brings a request, a PRD or review findings.
argument-hint: request | prd | spec and findings
---

# Spec

```mermaid
flowchart LR
  source([request or PRD]) --> build["actions/01-build.md"]
  build -->|"too vague"| asked((one question, no write))
  build --> spec((spec.md and its gaps))
  findings([spec and findings]) --> refine["actions/02-refine.md"]
  refine --> spec
  refine -->|"locked, or nothing to change"| unchanged((no write))
```

## Transversal rules

- Never invent: mark each gap instead of guessing.
- Never explore the codebase.
- Hold intent, never implementation: no library, framework pattern or file layout.
- Never rewrite a spec whose status is `locked`, a status only the person who approves it sets.
