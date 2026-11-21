---
name: test
description: Routes test work under tests/ to the reference that holds its procedure. Use for a golden snapshot, a user-reported bug fix or a test challenge pass.
---

# Test

```mermaid
flowchart LR
  entry([test work]) -->|"golden or snapshot"| golden["references/golden-machine-independence.md"]
  entry -->|"user-reported bug fix"| bug["references/bug-empirical-reproduction.md"]
  entry -->|"challenge a context's tests"| pass["references/test-challenge-pass.md"]
  entry -->|"any other test"| rule["rules/cli-tests.md"]
```

## Transversal rules

- Levels, guards, discipline and the grid live in `.claude/rules/cli-tests.md`; do not restate them here.
- Commands and fixtures live in `aidd_docs/memory/testing.md`.
- Production code belongs to the rule page of its context, under `.claude/rules/cli-contexts`, or the `tools` skill.
