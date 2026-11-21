---
name: 06-answer-comments
description: Answers PR/MR review comments, resolves settled threads and summarizes pending decisions, proposing learnings without reviewing or fixing code.
argument-hint: PR/MR URL | number
---

# Answer Comments

```mermaid
flowchart LR
  request([pull or merge request]) --> answer["actions/01-answer-comments.md"]
  answer -->|"invalid input"| stopped((stopped))
  answer <-->|"summary to select or adopt"| user((user answers))
  answer -->|"unclassified history"| withheld((summary withheld))
  answer -->|"published state mismatch"| answer
  answer --> done([threads answered, summary updated])
  done -.->|"new reply or pushed commit"| request
```

## Transversal rules

- Reach the pull or merge request through the VCS tool `aidd_docs/memory/vcs.md` names, else the one the remote points to.
- Read code and history as evidence.
- Never modify source, write a rule, memory or skill, commit, push, or merge the request.
