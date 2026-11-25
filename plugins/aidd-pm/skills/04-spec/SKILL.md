---
name: 04-spec
description: Creates or updates a feature's spec, the contract it is built to, when the user brings a need or changes to an existing spec.
argument-hint: need | spec and changes
---

# Spec

```mermaid
flowchart LR
  source([need]) --> build["actions/01-build.md"]
  build -->|"no outcome to name"| asked((one question, no write))
  build --> spec((spec.md, its gaps as questions))
  spec -->|"changes"| refine
  changes([spec and changes]) --> refine["actions/02-refine.md"]
  refine --> spec
  refine -->|"locked, or nothing to change"| unchanged((no write))
```

## Transversal rules

- Never explore the codebase.
- End with at most three open gaps as questions, those that would change the target most.
- Never rewrite a spec whose status is `locked`, nor change or offer to change that status: only the person who approves it does.
