---
name: 07-command-generate
description: Creates or updates a slash command, a one-shot prompt typed as /name, across the host AI tools, when the user wants a new command or to refactor one.
argument-hint: goal
---

# Command Generate

```mermaid
flowchart LR
  entry([request]) -->|"new command"| frame["actions/01-frame.md"]
  entry -->|"command file exists"| frame
  frame <-->|"goal, name and targets to confirm"| user((user answers))
  frame -->|"host tools or plugin source"| write["actions/02-write.md"]
  frame -->|"needs files or many steps"| skill((use a skill))
  write --> validate["actions/03-validate.md"]
  write -->|"writer refusal or error"| stopped((stopped))
  validate -->|"breach"| validate
  validate -->|"every file passes"| done((validated))
  validate -->|"fix declined or impossible"| blocked((blocked))
```

## Transversal rules

- If a cited reference cannot be read, stop and report the missing file.
- Keep the meaning of each line of an existing command, unless the request changes it.
