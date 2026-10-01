---
name: 12-release-notes
description: Produces traceable release notes from the tickets and merged changes of a release, with internal and customer variants. Use when the user wants to announce, summarize, or communicate a release. Not for cutting a version tag or writing a changelog entry.
argument-hint: release | range | tickets
---

# Release Notes

```mermaid
flowchart LR
  source([release, ref range, or ticket list]) --> collect --> draft --> review --> finalize
  collect -->|"nothing resolvable"| ask([one question])
  collect -->|"handoff"| offer([capability offered])
  review -->|"revise"| draft
  finalize -->|"approved"| done([saved release notes])
  finalize -->|"not approved"| session([notes kept in session])
```

## Actions

Run the flow above. Read only the next action file.

| Action   | Does                                            |
| -------- | ----------------------------------------------- |
| collect  | gather the release facts into one fact sheet    |
| draft    | write the notes for each audience from the facts |
| review   | challenge every claim and what goes public      |
| finalize | save the approved notes                          |

## Transversal rules

- Never invent a feature, metric, date, or user; mark every gap instead.
- Every item in the notes traces to a ticket, pull request, or commit.
- Derive every audience variant from the same fact sheet.
- Read the repository and the ticketing tool; never write to either.
- Keep wording and publication decisions with the user.
- Require explicit approval before any write; never share, send, or publish the notes.
- Ask natural questions; never expose actions, references, or unchanged state.
