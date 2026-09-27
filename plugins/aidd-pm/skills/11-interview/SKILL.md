---
name: 11-interview
description: Prepares a user interview guide before a meeting, then restructures its raw transcript into a question by question synthesis with exact verbatims. Use when the user wants to prepare or synthesize an interview or client meeting. Not for product decisions.
argument-hint: meeting | transcript
---

# Interview

```mermaid
flowchart LR
  meeting([upcoming meeting]) --> frame
  transcript([transcript]) --> frame
  frame -->|"before the meeting"| prepare
  frame -->|"after the meeting"| synthesize
  frame -->|"not an interview"| handoff([capability offered])
  prepare --> finalize
  synthesize --> finalize
  finalize -->|"revise guide"| prepare
  finalize -->|"revise synthesis"| synthesize
  finalize -->|"authorized"| done([guide or synthesis])
```

## Actions

Run the flow above. Read only the next action file.

| Action     | Does                                          |
| ---------- | --------------------------------------------- |
| frame      | resolve the route and the meeting context     |
| prepare    | build an interview guide for one meeting      |
| synthesize | restructure one transcript by question asked  |
| finalize   | revise, anonymize, keep, or persist           |

## Transversal rules

- Keep conclusions and product decisions with the user.
- Never invent a quote, figure, name, or context field; ask for it or mark it unknown.
- Anonymize personal data in every output once the user asks for it.
- Accept transcripts as pasted text or files from any meeting or dictation tool; depend on none.
- Emit plain Markdown that pastes into a wiki or ticketing tool unchanged.
- Ask natural questions, one at a time; never expose actions, references, or unchanged state.
- Require explicit approval before any write.
