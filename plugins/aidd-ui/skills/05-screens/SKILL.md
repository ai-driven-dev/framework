---
name: 05-screens
description: Write a project's screens, one for each wireframe, by comparing variants of each. Use when the user wants to dress a wireframe as a screen. Not for the brand, tokens, components, or journeys.
argument-hint: request
---
# Screens

## Actions

```mermaid
flowchart LR
  prepare["prepare<br>actions/01-prepare.md"] --> propose["propose<br>actions/02-propose.md"]
  propose --> choose["choose<br>actions/03-choose.md"]
  choose -->|"no variant stands out"| propose
  choose -->|"a wireframe is left"| propose
  choose --> conclude["conclude<br>actions/04-conclude.md"]
  prepare -->|"a review sent a screen back"| conclude
  prepare -->|"a decision blocks"| user((user answers))
  propose -->|"a decision blocks"| user
  choose -->|"give the page, wait"| user
  user --> prepare
  user --> propose
  user --> choose
  conclude -->|"an error is left"| conclude
  conclude --> done((done))
  prepare -->|"no engine, no system, or a component is missing"| stop((stop))
```

Each box is a file: read it, then do what it says.

## Transversal rules

- Speak only to ask or to give the final reply.
- Word each question, its options and its labels in the person's language.
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
- Every path written in a record starts there.
- Write only `screens/` and `drafts/` under `aidd_docs/ui/`.
- Never write in the code, nor by hand what the engine writes.
- Never create a component: name the missing one and stop.
- After each write, fix what the hook or the validation reports.
- Never bypass a hook.
- Commit and push only when asked.
