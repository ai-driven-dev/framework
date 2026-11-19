---
name: 02-challenge
description: Challenges finished work against its agreed plan with a confidence score, when recent work needs stress-testing, not for style review or code.
argument-hint: work
---

# Challenge

```mermaid
flowchart LR
  work([work and agreed reference]) --> challenge["actions/01-challenge.md"]
  challenge --> report([findings report with confidence])
```

## Transversal rules

- Reason from first principles, no logical gaps.
- Aim for simplifications: if the work can be smaller, say so.
