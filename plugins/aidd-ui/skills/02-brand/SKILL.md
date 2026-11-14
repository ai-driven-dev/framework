---
name: 02-brand
description: Write a project's brand, from its code or from scratch, or evolve it, by comparing directions. Use when the user wants to set or capture a project's identity, users, tone and references. Not for tokens, components, screens, or journeys.
argument-hint: request
---
# Brand

## Actions

```mermaid
flowchart LR
  prepare["prepare<br>actions/01-prepare.md"] --> propose["propose<br>actions/02-propose.md"]
  propose --> choose["choose<br>actions/03-choose.md"]
  choose --> conclude["conclude<br>actions/04-conclude.md"]
  prepare -->|"a decision blocks"| user((user answers))
  propose -->|"a decision blocks"| user
  choose -->|"next round"| propose
  choose -->|"give the page, wait"| user
  user --> prepare
  user --> propose
  user --> choose
  conclude -->|"an error is left"| conclude
  conclude --> done((done))
  prepare -->|"no engine"| stop((stop))
```

Each box is a file: read it, then do what it says.

## Transversal rules

- Speak only to ask or to give the final reply.
- Ask every question, option and label in the language the person writes.
- Name a record by its title and a state by its label.
- Say what the person will see, in their words.
- Never show a path, file name, id, rule code or size.
- Never show a version number, skill name, history or changelog.
- Never give a unit, or a count of warnings.
- Never use jargon: no wireframe, design system, token or hex code. Say what it is.
- Say « maquette » for a wireframe, never « plan ».
- Name a step by what it does, never by its skill name.
- Name the showcase plainly, « la vitrine » in French.
- Say once per conversation how to open it: double-click `index.html` in `aidd_docs/ui/showcase/`. Give no other path.
- To show a page, point to it in the showcase.
- Never hand over a capture or a temp file.
- End a reply with one next step or one needed question. Hold the others.
- Never end on an offer or a yes/no about more work.
- After asking, wait for the answer.
- Otherwise call tools.
- Run the engine from the project root; never read its source.
- Write only `aidd_docs/ui/brand.md` and `aidd_docs/ui/drafts/brand/`.
- After each write, fix what the hook or the validation reports.
- Never bypass a hook.
- Record the history without asking. Change only what was named.
- Saving means writing the design files. Never branch, commit or push unless the person asks for git.
