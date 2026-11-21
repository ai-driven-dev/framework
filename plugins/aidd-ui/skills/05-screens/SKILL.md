---
name: 05-screens
description: Writes a project's screens, one per wireframe, by comparing variants when the user wants to dress a wireframe, not brand, components or journeys.
argument-hint: request
---
# Screens

```mermaid
flowchart LR
  prepare["actions/01-prepare.md"] --> propose["actions/02-propose.md"]
  propose --> choose["actions/03-choose.md"]
  choose -->|"no variant stands out"| propose
  choose -->|"a wireframe is left"| propose
  choose --> conclude["actions/04-conclude.md"]
  prepare -->|"a review sent a screen back"| conclude
  prepare -->|"a decision blocks"| user((user answers))
  propose -->|"a decision blocks"| user
  choose -->|"give the page, wait"| user
  user --> prepare
  user -->|"answer to propose"| propose
  user -->|"answer to choose"| choose
  conclude -->|"an error is left"| conclude
  conclude --> done((done))
  prepare -->|"no engine, no system, or a component is missing"| stop((stop))
```

## Transversal rules

- Read each box's file, then do what it says.
- Call tools, speaking only to ask or to give the final reply.
- After asking, wait for the answer.
- Write every reply, question, option and label in the language the person writes in, even when the project's own files use another.
- Say what the person will see, by record title and state label.
- Never show a path, file name, id, rule code, size, version or unit.
- Never show a skill name, history, changelog or warning count.
- Never use jargon like wireframe, design system, token or hex code.
- Say « maquette » for a wireframe, never « plan ».
- Call the showcase « la vitrine » in French, and show a page by pointing to it.
- Say once per conversation: double-click `index.html` in `aidd_docs/ui/showcase/`.
- On a web project, show a width by pointing to the Ordinateur or Téléphone switch.
- Never hand over a capture or a temp file.
- End with one next step or question, never on an offer or a yes/no.
- Save by writing the design files, and never use git unless asked.
- Write only `screens/` and `drafts/` under `aidd_docs/ui/`.
- Never write in the code, nor by hand what the engine writes.
- Start every path written in a record at the project root.
- Never create a component: name the missing one and stop.
