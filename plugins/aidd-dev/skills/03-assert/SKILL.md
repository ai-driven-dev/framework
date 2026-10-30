---
name: 03-assert
description: Assert the work against the project's coding assertions into a pass or fail report. Use to verify an implementation before it ships. Not for fixing code, reviewing a diff, or writing tests.
argument-hint: work | task folder
---

# Assert

## Actions

```mermaid
flowchart LR
  assert["assert<br>actions/01-assert.md"] -->|"task folder: a round appended"| report["assert.md"]
  assert -->|"no task folder: keep it in a file?"| user((user answers))
  user -->|yes| report
  user -->|no| done((done))
  report --> done
  assert -->|"no check found"| stop((stop))
```

Each box is a file: read it, then do what it says.

## Transversal rules

- Speak only to ask or to give the final reply; otherwise call tools.
- Verdict from exit codes only: one non-zero exit is a FAIL.
- Change nothing but the report: no code, no test, no config.
- Do not commit or push.
