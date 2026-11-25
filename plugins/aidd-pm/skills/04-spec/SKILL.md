---
name: 04-spec
description: Creates a feature's spec, the contract it is built to, or updates one, when the user brings a request, a PRD, review findings or answers.
argument-hint: request | prd | spec and findings
---

# Spec

```mermaid
flowchart LR
  source([request or PRD]) --> build["actions/01-build.md"]
  build -->|"too vague"| asked((one question, no write))
  build --> spec((spec.md, its gaps as questions))
  spec -->|"answers"| refine
  findings([spec and findings]) --> refine["actions/02-refine.md"]
  refine --> spec
  refine -->|"locked, or nothing to change"| unchanged((no write))
```

## Transversal rules

- Never explore the codebase.
- End with at most three open gaps as questions, those that would change the target most.
- Never rewrite a spec whose status is `locked`: only the person who approves it sets that status.
