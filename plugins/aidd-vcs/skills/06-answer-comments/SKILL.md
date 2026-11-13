---
name: 06-answer-comments
description: Answers pull or merge request review comments, resolves settled threads, and proposes learnings. Use when the user wants review feedback answered or pending decisions summarized. Not for reviewing a diff or fixing code.
argument-hint: pull request | merge request
---

# Answer Comments

```mermaid
flowchart LR
  request([pull or merge request]) --> answer-comments --> propose-learnings --> summary([summary updated])
  summary -.->|new reply or pushed commit| request
```

## Actions

Run the flow above. Read only the next action file.

| Action | Does |
| --- | --- |
| answer-comments | answer open review threads and resolve the settled ones |
| propose-learnings | propose lasting feedback and update the summary |

## Transversal rules

- Use the VCS tool named in the loaded project context; if absent, consult `aidd_docs/memory/vcs.md`, else infer it from the remote.
- Read code and history as evidence; never modify source, commit, push, or merge the request.
