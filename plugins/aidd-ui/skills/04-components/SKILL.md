---
name: 04-components
description: Write a project's components and assets, from nothing or from its code, or carry a component change to its new versions. Use when the user wants to add, extract, or change a component or an asset. Not for the brand, tokens, screens, or journeys.
argument-hint: request
---
# Components

## Actions

```mermaid
flowchart LR
  prepare["prepare<br>actions/01-prepare.md"] --> write["write<br>actions/02-write.md"]
  write --> conclude["conclude<br>actions/03-conclude.md"]
  prepare -->|"a decision blocks"| user((user answers))
  write -->|"a decision blocks"| user
  user --> prepare
  user --> write
  conclude -->|"an error is left"| conclude
  conclude --> done((done))
  prepare -->|"no engine, no system, or impact refused"| stop((stop))
```

Each box is a file: read it, then do what it says.

## Transversal rules

- Speak only to ask or to give the final reply.
- Put every question, choice and label in the language the person uses.
- Name a record by its title and a state by its label.
- Say what the person will see, in their words.
- Never show a path, file name, id, rule code or size.
- Never show a version number, skill name, history or changelog.
- Never give a unit, or a count of warnings.
- Never use jargon: no wireframe, design system, token or hex code. Say what it is.
- Name a step by what it does, never by its skill name.
- Name the showcase plainly, « la vitrine » in French.
- Say once how to open it: double-click `index.html` in `aidd_docs/ui/showcase/`. Give no other path.
- To show a page, point to it in the showcase.
- Never hand over a capture or a temp file.
- End a reply with exactly one next step or one question. Hold the others.
- After asking, wait for the answer.
- Otherwise call tools.
- Run the engine from the project root; never read its source.
- Every path written in a record starts there.
- Write only `components/`, `assets/` and `drafts/` under `aidd_docs/ui/`.
- Never write in the code, nor by hand what the engine writes.
- After each write, fix what the hook or the validation reports.
- Never bypass a hook.
- Record the history without asking. Change only what was named, and never offer more.
- Saving means writing the design files. Never branch, commit or push unless the person asks for git.
