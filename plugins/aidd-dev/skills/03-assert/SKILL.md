---
name: 03-assert
description: Judge the work against the project's coding assertions into one pass or fail report, changing nothing. Use to verify an implementation independently before it is committed or shipped. Not for fixing code, reviewing a diff, or writing tests.
argument-hint: work | task folder
---

# Assert

## Actions

```mermaid
flowchart LR
  assert["assert<br>actions/01-assert.md<br>script: scripts/run-assertions.cjs"] -->|"task folder: a round appended"| report["assert.md"]
  assert -->|"no task folder: keep it in a file?"| user((user answers))
  user -->|yes| assert
  user -->|no| done((done))
  report --> done
  assert -->|"no check to run"| stop((stop))
```

Each box is a file: read it, then do what it says.

## Transversal rules

- Speak only to ask or to give the final reply; otherwise call tools.
- The verdict is the script's first line, never your own reading.
- Change nothing but the report: no code, no test, no config.
- Do not commit or push.
