---
name: 02-project-memory
description: Set up, refresh or wire the project memory of its architecture, conventions and decisions into your AI tools. Use for any project memory request, even a bare "check". Not for one-file edits.
argument-hint: setup | refresh
---

# Project Memory

## Actions

```mermaid
flowchart LR
  request((request)) --> read["read<br>actions/01-read.md"]
  read -->|"nothing to change"| done((done))
  read -->|"one message"| user((user answers))
  user --> write["write<br>actions/02-write.md"]
  write --> wire["wire<br>actions/03-wire.md"]
  wire --> done
```

- Each box: read its action file, then follow it.

## Transversal rules

- A line already in the bank is the team's: quote it exactly and get a yes before you replace or remove it.
- Ask everything in one message, then wait; never ask twice.
- Edit no memory file outside write.
- When the skill's script exits 1, fix the call from what it prints; never do its work by hand.
- When the turn-end check lists lost lines, show them to the person exactly as given; restore one only if they ask.
- Fix each error the turn-end check gives on a line you wrote; keep a warned line the code confirms.
