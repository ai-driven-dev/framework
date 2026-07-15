---
name: 10-learn
description: Capture durable project learnings from the conversation or git history into memory, a record, a rule, or a skill. Use when the user asks to capture, record, or remember a decision or lesson. Not for AI preferences or already-captured items.
argument-hint: gather | assess | write | sync
---

# Learn

## Actions

`gather → assess → write → sync`. Run each action's `## Test` before the next, and read its file in `actions/` first. When nothing is worth learning, gather ends the skill.

| #   | Action   | Does                           |
| --- | -------- | ------------------------------ |
| 01  | `gather` | pick a source, collect lessons |
| 02  | `assess` | score, propose a home, ask     |
| 03  | `write`  | write the approved lessons     |
| 04  | `sync`   | refresh the memory block       |

## Transversal rules

- Ask before you write. Show each lesson's score and home, let the user keep, move, or skip it, and write nothing until they answer.
- Capture the user's project, never AIDD's own scaffold.
