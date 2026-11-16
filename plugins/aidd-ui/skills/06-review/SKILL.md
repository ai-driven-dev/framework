---
name: 06-review
description: Review a project's wireframes, screens, and components in the showcase, then publish the ones every state of which is OK. Use when the user wants to review, approve, or publish them. Not for writing or changing them.
argument-hint: request
---
# Review

## Actions

```mermaid
flowchart LR
  prepare["prepare<br>actions/01-prepare.md"] --> propose["propose<br>actions/02-propose.md"]
  propose --> choose["choose<br>actions/03-choose.md"]
  choose --> write["write<br>actions/04-write.md"]
  write --> conclude["conclude<br>actions/05-conclude.md"]
  prepare -->|"a decision blocks"| user((user answers))
  propose -->|"give the pages, wait"| user
  choose -->|"a state has no verdict"| user
  user --> prepare
  user --> propose
  user --> choose
  conclude -->|"an error is left"| conclude
  conclude --> done((done))
  prepare -->|"no engine, no system, or nothing to review"| stop((stop))
```

Each box is a file: read it, then do what it says.

## Transversal rules

- Speak only to ask or to give the final reply.
- Name a record by its title and a state by its label.
- Say what the person will see, in their words.
- Never show a path, file name, id, rule code or size.
- Never give a unit, or a count of warnings.
- Never use jargon: no wireframe, design system, token or hex code. Say what it is.
- Name the showcase plainly, « la vitrine » in French.
- Say once how to open it: double-click `index.html` in `aidd_docs/ui/showcase/`. Give no other path.
- To show a page, point to it in the showcase.
- Never hand over a capture or a temp file.
- End a reply with exactly one next step or one question. Hold the others.
- A web screen's page has a width switch, Ordinateur or Téléphone. Point to it to show a width.
- After asking, wait for the answer.
- Otherwise call tools.
- Run the engine from the project root; never read its source.
- Write only `reviews/` under `aidd_docs/ui/`.
- Never write in the code, nor by hand what the engine writes.
- Never write a capture: the user saves it.
- After each write, fix what the hook or the validation reports.
- Never bypass a hook.
- Commit and push only when asked.
