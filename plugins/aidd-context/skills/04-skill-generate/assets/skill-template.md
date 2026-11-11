---
name: <skill-name>
description: <One sentence: what it does, then when to use it.>
argument-hint: <what the user brings: their cases, or the artifact consumed>
<OPTIONAL. The plan's accepted risk step, `disable-model-invocation: true` or a `hooks:` block. Omit otherwise.>
---

# <Skill Name>

```mermaid
flowchart LR
  <one node per action file, labeled only with its actions/NN-slug.md path; an entry per case, a back-edge per loop, a quoted label per condition, a terminal per outcome>
```

## Transversal rules

<OPTIONAL. Rules owned by no reference or single action, one per line. Omit the section when none.>

- <One plain sentence.>

> Fill every `<...>` and delete this line. An angle bracket left in the written file is a bug.
