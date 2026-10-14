---
name: 02-demo
description: Show a journey or bug through a browser video or CLI transcript. Use for reviewer evidence, not acceptance verification or fixes.
argument-hint: journey | candidate
---

# Demo

## Actions

Run [record](actions/01-record.md).

## Transversal rules

- Run against the candidate; never patch it or delete data not proven test-only.
- Called by another skill or agent: never ask; return `blocked` with the question.
